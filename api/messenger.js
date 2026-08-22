// api/messenger.js — SMS + Email marketing platform
// Actions: list_contacts, sync_lsa, send_campaign, list_campaigns, save_campaign

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
  const RESEND_KEY   = process.env.RESEND_API_KEY;
  const TWILIO_SID   = process.env.TWILIO_SID;
  const TWILIO_TOKEN = process.env.TWILIO_TOKEN;
  const TWILIO_FROM  = process.env.TWILIO_FROM;

  // Without the service key every Supabase call below comes back 401. Those
  // errors used to be handed to the dashboard as if they were the data, so the
  // contacts table rendered "No contacts yet. Click Sync LSA Leads to import."
  // — telling Sean to click a button that could not work either.
  if (!SERVICE_KEY) {
    console.error('SUPABASE_SERVICE_KEY missing — messenger cannot read or write.');
    return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY is not set on this deployment — contacts and campaigns cannot be loaded.' });
  }

  const sbH = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  // A non-JSON body threw here and crashed the whole handler with a bare 500.
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch (_) {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  const action = req.query.action || body.action;

  // PostgREST signals failure with a 4xx/5xx plus a JSON error object. Returning
  // that object straight through as the data payload made a broken query
  // (missing table, RLS change, bad key) look exactly like an empty table.
  // Throw instead, so the caller gets a real error to show.
  async function sb(url, opts) {
    const r = await fetch(url, { headers: sbH, ...(opts || {}) });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) {}
    if (!r.ok) {
      const err = new Error(data?.message || data?.error || text || `Supabase HTTP ${r.status}`);
      err.status = r.status;
      throw err;
    }
    return data;
  }

  try {
    // ── LIST CONTACTS ────────────────────────────────────────────────────────
    if (action === 'list_contacts') {
      const clientFilter = req.query.client_id ? `&client_id=eq.${req.query.client_id}` : '';
      const contacts = await sb(
        `${SUPABASE_URL}/rest/v1/contacts?select=*,clients(business_name)&order=created_at.desc&limit=500${clientFilter}`
      );
      return res.status(200).json({ ok: true, contacts: Array.isArray(contacts) ? contacts : [] });
    }

    // ── SYNC LSA → CONTACTS ──────────────────────────────────────────────────
    if (action === 'sync_lsa') {
      const clientFilter = body.client_id ? `&client_id=eq.${body.client_id}` : '';
      // Get LSA leads with phone numbers
      const leads = await sb(
        `${SUPABASE_URL}/rest/v1/lsa_leads?customer_phone=not.is.null&select=id,client_id,customer_name,customer_phone${clientFilter}`
      );
      // Filter out empty strings client-side
      const validLeads = Array.isArray(leads) ? leads.filter(l => l.customer_phone?.trim()) : [];

      let added = 0, failed = 0;
      for (const lead of validLeads) {
        // Upsert by (client_id, phone) — skip if already exists
        const existing = await sb(
          `${SUPABASE_URL}/rest/v1/contacts?client_id=eq.${lead.client_id}&phone=eq.${encodeURIComponent(lead.customer_phone)}&select=id&limit=1`
        );
        if (Array.isArray(existing) && existing.length) continue;

        // A rejected insert used to be invisible: `added` was incremented
        // regardless, so the sync reported importing contacts it never saved.
        try {
          await sb(`${SUPABASE_URL}/rest/v1/contacts`, {
            method: 'POST',
            body: JSON.stringify({
              client_id: lead.client_id,
              name: lead.customer_name || 'LSA Lead',
              phone: lead.customer_phone,
              source: 'lsa',
              source_ref_id: lead.id,
              opted_out: false,
            }),
          });
          added++;
        } catch (e) {
          console.error('Contact insert failed for lead', lead.id, e.message);
          failed++;
        }
      }

      return res.status(200).json({ ok: true, synced: validLeads.length, added, failed });
    }

    // ── LIST CAMPAIGNS ───────────────────────────────────────────────────────
    if (action === 'list_campaigns') {
      const clientFilter = req.query.client_id ? `&client_id=eq.${req.query.client_id}` : '';
      const campaigns = await sb(
        `${SUPABASE_URL}/rest/v1/campaigns?select=*,clients(business_name)&order=created_at.desc&limit=100${clientFilter}`
      );
      return res.status(200).json({ ok: true, campaigns: Array.isArray(campaigns) ? campaigns : [] });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // ── SAVE CAMPAIGN (draft) ────────────────────────────────────────────────
    if (action === 'save_campaign') {
      const { client_id, name, channel, subject, body_sms, body_email } = body;
      if (!client_id || !name || !channel) return res.status(400).json({ error: 'client_id, name, channel required' });
      const data = await sb(`${SUPABASE_URL}/rest/v1/campaigns`, {
        method: 'POST',
        body: JSON.stringify({ client_id, name, channel, subject, body_sms, body_email, status: 'draft' }),
      });
      return res.status(200).json({ ok: true, campaign: Array.isArray(data) ? data[0] : data });
    }

    // ── SEND CAMPAIGN ────────────────────────────────────────────────────────
    if (action === 'send_campaign') {
      const { campaign_id, client_id, name, channel, subject, body_sms, body_email } = body;
      if (!client_id || !channel) return res.status(400).json({ error: 'client_id and channel required' });

      // Refuse up front when the provider for every requested channel is
      // unconfigured. The send loop skips a channel whose credentials are
      // missing, so the campaign was being marked "sent" after reaching nobody
      // — with 0/0 counts and nothing saying why. Twilio is the live case:
      // 10DLC registration is still pending.
      const wantsSms    = channel === 'sms'   || channel === 'both';
      const wantsEmail  = channel === 'email' || channel === 'both';
      const smsReady    = !!(TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM);
      const emailReady  = !!RESEND_KEY;
      if (!(wantsSms && smsReady) && !(wantsEmail && emailReady)) {
        const need = [];
        if (wantsSms)   need.push('Twilio (TWILIO_SID / TWILIO_TOKEN / TWILIO_FROM)');
        if (wantsEmail) need.push('Resend (RESEND_API_KEY)');
        return res.status(200).json({
          ok: false,
          error: `Cannot send — missing credentials for ${need.join(' and ')}. Nothing was sent and the campaign was not marked sent.`,
        });
      }
      const warning = (wantsSms && !smsReady)     ? 'SMS was skipped — Twilio is not configured on this deployment.'
                    : (wantsEmail && !emailReady) ? 'Email was skipped — Resend is not configured on this deployment.'
                    : null;

      // Get contacts for this client (not opted out, has required contact info)
      let contactsUrl = `${SUPABASE_URL}/rest/v1/contacts?client_id=eq.${client_id}&opted_out=eq.false`;
      if (channel === 'sms')   contactsUrl += '&phone=not.is.null&phone=neq.';
      if (channel === 'email') contactsUrl += '&email=not.is.null&email=neq.';

      const contacts = await sb(contactsUrl);
      if (!Array.isArray(contacts) || !contacts.length) {
        return res.status(200).json({ ok: false, error: 'No eligible contacts found' });
      }

      // Upsert campaign record
      let campaignId = campaign_id;
      if (!campaignId) {
        const cd = await sb(`${SUPABASE_URL}/rest/v1/campaigns`, {
          method: 'POST',
          body: JSON.stringify({ client_id, name, channel, subject, body_sms, body_email, status: 'sending', sent_at: new Date().toISOString() }),
        });
        campaignId = (Array.isArray(cd) ? cd[0] : cd)?.id;
      }
      // Every per-message row hangs off this id, and the final status PATCH
      // targets it. Without an id the messages were orphaned and the campaign
      // was never marked sent — so don't start blasting.
      if (!campaignId) {
        return res.status(500).json({ error: 'Could not create the campaign record — nothing was sent.' });
      }

      // Per-message logging is best-effort: a failed log row must not abort a
      // send that is already half-delivered.
      const logMessage = async (row) => {
        try {
          await sb(`${SUPABASE_URL}/rest/v1/messages`, { method: 'POST', body: JSON.stringify(row) });
        } catch (e) {
          console.error('Message log insert failed:', e.message);
        }
      };

      let sent = 0, failed = 0;

      for (const contact of contacts) {
        // Send SMS via Twilio
        if (wantsSms && smsReady && contact.phone) {
          try {
            const formBody = new URLSearchParams({
              To: contact.phone,
              From: TWILIO_FROM,
              Body: body_sms,
            });
            const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
              method: 'POST',
              headers: {
                Authorization: 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: formBody,
            });
            const smsData = await smsRes.json();
            // Twilio signals rejection with a non-2xx as well as error_code —
            // checking only error_code counted a hard failure as "sent".
            const status = (smsRes.ok && !smsData.error_code) ? 'sent' : 'failed';
            if (status === 'failed') console.error('Twilio send failed:', smsRes.status, smsData.message || smsData.error_code);
            await logMessage({ campaign_id: campaignId, contact_id: contact.id, channel: 'sms', status, provider_id: smsData.sid, sent_at: new Date().toISOString() });
            status === 'sent' ? sent++ : failed++;
          } catch (e) { console.error('Twilio send threw:', e.message); failed++; }
        }

        // Send Email via Resend
        if (wantsEmail && emailReady && contact.email) {
          try {
            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'EVAN Enterprises <leads@evanenterprise.com>',
                to: [contact.email],
                subject: subject || name,
                html: body_email || `<p>${body_sms}</p>`,
              }),
            });
            const emailData = await emailRes.json();
            const status = (emailRes.ok && emailData.id) ? 'sent' : 'failed';
            if (status === 'failed') console.error('Resend send failed:', emailRes.status, emailData.message);
            await logMessage({ campaign_id: campaignId, contact_id: contact.id, channel: 'email', status, provider_id: emailData.id, sent_at: new Date().toISOString() });
            status === 'sent' ? sent++ : failed++;
          } catch (e) { console.error('Resend send threw:', e.message); failed++; }
        }
      }

      // Mark campaign sent
      try {
        await sb(`${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() }),
        });
      } catch (e) {
        console.error('Campaign status PATCH failed:', e.message);
      }

      return res.status(200).json({ ok: true, sent, failed, contacts: contacts.length, warning });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('messenger error:', action, e.message);
    return res.status(e.status && e.status >= 400 && e.status < 500 ? 400 : 500)
      .json({ error: e.message || 'Messenger request failed' });
  }
}
