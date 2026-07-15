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

  const sbH = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  const action = req.query.action || req.body?.action;
  const body   = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

  // ── LIST CONTACTS ──────────────────────────────────────────────────────────
  if (action === 'list_contacts') {
    const clientFilter = req.query.client_id ? `&client_id=eq.${req.query.client_id}` : '';
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/contacts?select=*,clients(business_name)&order=created_at.desc&limit=500${clientFilter}`,
      { headers: sbH }
    );
    const contacts = await r.json();
    return res.status(200).json({ ok: true, contacts });
  }

  // ── SYNC LSA → CONTACTS ────────────────────────────────────────────────────
  if (action === 'sync_lsa') {
    const clientFilter = body.client_id ? `&client_id=eq.${body.client_id}` : '';
    // Get LSA leads with phone numbers
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/lsa_leads?customer_phone=not.is.null&select=id,client_id,customer_name,customer_phone${clientFilter}`,
      { headers: sbH }
    );
    const leads = await r.json();
    // Filter out empty strings client-side
    const validLeads = Array.isArray(leads) ? leads.filter(l => l.customer_phone?.trim()) : [];

    let added = 0;
    for (const lead of validLeads) {
      // Upsert by (client_id, phone) — skip if already exists
      const check = await fetch(
        `${SUPABASE_URL}/rest/v1/contacts?client_id=eq.${lead.client_id}&phone=eq.${encodeURIComponent(lead.customer_phone)}&select=id&limit=1`,
        { headers: sbH }
      );
      const existing = await check.json();
      if (Array.isArray(existing) && existing.length) continue;

      await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
        method: 'POST',
        headers: sbH,
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
    }

    return res.status(200).json({ ok: true, synced: validLeads.length, added });
  }

  // ── LIST CAMPAIGNS ─────────────────────────────────────────────────────────
  if (action === 'list_campaigns') {
    const clientFilter = req.query.client_id ? `&client_id=eq.${req.query.client_id}` : '';
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/campaigns?select=*,clients(business_name)&order=created_at.desc&limit=100${clientFilter}`,
      { headers: sbH }
    );
    const campaigns = await r.json();
    return res.status(200).json({ ok: true, campaigns });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── SAVE CAMPAIGN (draft) ──────────────────────────────────────────────────
  if (action === 'save_campaign') {
    const { client_id, name, channel, subject, body_sms, body_email } = body;
    if (!client_id || !name || !channel) return res.status(400).json({ error: 'client_id, name, channel required' });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/campaigns`, {
      method: 'POST',
      headers: sbH,
      body: JSON.stringify({ client_id, name, channel, subject, body_sms, body_email, status: 'draft' }),
    });
    const data = await r.json();
    return res.status(200).json({ ok: true, campaign: Array.isArray(data) ? data[0] : data });
  }

  // ── SEND CAMPAIGN ──────────────────────────────────────────────────────────
  if (action === 'send_campaign') {
    const { campaign_id, client_id, name, channel, subject, body_sms, body_email } = body;

    // Get contacts for this client (not opted out, has required contact info)
    let contactsUrl = `${SUPABASE_URL}/rest/v1/contacts?client_id=eq.${client_id}&opted_out=eq.false`;
    if (channel === 'sms')   contactsUrl += '&phone=not.is.null&phone=neq.';
    if (channel === 'email') contactsUrl += '&email=not.is.null&email=neq.';

    const contactsRes = await fetch(contactsUrl, { headers: sbH });
    const contacts = await contactsRes.json();

    if (!contacts.length) return res.status(200).json({ ok: false, error: 'No eligible contacts found' });

    // Upsert campaign record
    let campaignId = campaign_id;
    if (!campaignId) {
      const cr = await fetch(`${SUPABASE_URL}/rest/v1/campaigns`, {
        method: 'POST',
        headers: sbH,
        body: JSON.stringify({ client_id, name, channel, subject, body_sms, body_email, status: 'sending', sent_at: new Date().toISOString() }),
      });
      const cd = await cr.json();
      campaignId = (Array.isArray(cd) ? cd[0] : cd)?.id;
    }

    let sent = 0, failed = 0;

    for (const contact of contacts) {
      // Send SMS via Twilio
      if ((channel === 'sms' || channel === 'both') && contact.phone && TWILIO_SID) {
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
          const status = smsData.error_code ? 'failed' : 'sent';
          await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
            method: 'POST', headers: sbH,
            body: JSON.stringify({ campaign_id: campaignId, contact_id: contact.id, channel: 'sms', status, provider_id: smsData.sid, sent_at: new Date().toISOString() }),
          });
          status === 'sent' ? sent++ : failed++;
        } catch (_) { failed++; }
      }

      // Send Email via Resend
      if ((channel === 'email' || channel === 'both') && contact.email && RESEND_KEY) {
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
          const status = emailData.id ? 'sent' : 'failed';
          await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
            method: 'POST', headers: sbH,
            body: JSON.stringify({ campaign_id: campaignId, contact_id: contact.id, channel: 'email', status, provider_id: emailData.id, sent_at: new Date().toISOString() }),
          });
          status === 'sent' ? sent++ : failed++;
        } catch (_) { failed++; }
      }
    }

    // Mark campaign sent
    await fetch(`${SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}`, {
      method: 'PATCH', headers: sbH,
      body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() }),
    });

    return res.status(200).json({ ok: true, sent, failed, contacts: contacts.length });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
