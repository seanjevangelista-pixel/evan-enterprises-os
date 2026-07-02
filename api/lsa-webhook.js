// api/lsa-webhook.js
// Receives forwarded Google LSA lead notification emails via Resend inbound webhook
// Parses lead info, logs to Supabase lsa_leads table, and emails Sean + client

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const resendKey   = process.env.RESEND_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  const sbHeaders = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  // ── Parse inbound email payload (Resend inbound format) ────────────────────
  // Resend sends: { from, to, subject, text, html, ... }
  const payload = req.body || {};

  const rawTo      = payload.to   || '';
  const rawFrom    = payload.from || '';
  const subject    = payload.subject || '';
  const bodyText   = payload.text || payload.html?.replace(/<[^>]+>/g, ' ') || '';

  // Also support direct JSON from a simple form POST or test:
  // { client_id, customer_name, customer_phone, lead_type, service, notes }
  const directClientId = req.query.client_id || payload.client_id || null;

  // ── Extract lead details from email body ───────────────────────────────────
  const customerName  = extractName(bodyText)  || payload.customer_name  || 'LSA Lead';
  const customerPhone = extractPhone(bodyText) || payload.customer_phone || '';
  const leadType      = detectLeadType(subject, bodyText) || payload.lead_type || 'call';
  const service       = extractService(bodyText) || payload.service || '';

  const notesSummary  = buildNotes({ subject, bodyText, rawFrom, service });

  // ── Look up client in Supabase ─────────────────────────────────────────────
  let clientId   = directClientId;
  let clientName = 'Client';
  let clientEmail = null;

  if (!clientId) {
    // Try to match by the "to" email address against clients.owner_email
    const toEmail = extractEmail(rawTo);
    if (toEmail) {
      try {
        const r = await fetch(
          `${supabaseUrl}/rest/v1/clients?owner_email=eq.${encodeURIComponent(toEmail)}&select=id,business_name,owner_email&limit=1`,
          { headers: sbHeaders }
        );
        const rows = await r.json();
        if (Array.isArray(rows) && rows.length) {
          clientId    = rows[0].id;
          clientName  = rows[0].business_name;
          clientEmail = rows[0].owner_email;
        }
      } catch (_) {}
    }
  } else {
    // Fetch client name/email by id
    try {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/clients?id=eq.${clientId}&select=id,business_name,owner_email&limit=1`,
        { headers: sbHeaders }
      );
      const rows = await r.json();
      if (Array.isArray(rows) && rows.length) {
        clientName  = rows[0].business_name;
        clientEmail = rows[0].owner_email;
      }
    } catch (_) {}
  }

  if (!clientId) {
    return res.status(200).json({
      ok: false,
      error: 'Could not match email to a client. Add ?client_id=<uuid> or ensure the to-address matches a client owner_email.',
    });
  }

  // ── Insert lead into lsa_leads ─────────────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const leadRow = {
    client_id:     clientId,
    lead_date:     today,
    lead_type:     leadType,
    customer_name: customerName,
    customer_phone: customerPhone,
    status:        'new',
    cost_per_lead: 0,
    notes:         notesSummary,
  };

  let insertedLead = null;
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/lsa_leads`, {
      method: 'POST',
      headers: sbHeaders,
      body: JSON.stringify(leadRow),
    });
    const rows = await r.json();
    insertedLead = Array.isArray(rows) ? rows[0] : rows;
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Failed to insert lead: ' + e.message });
  }

  // ── Send notification emails via Resend ────────────────────────────────────
  if (resendKey) {
    const emailHtml = buildEmailHtml({ clientName, customerName, customerPhone, leadType, service, today, notesSummary });
    const emailSubject = `New LSA Lead — ${clientName}`;

    const recipients = ['seanjevangelista@gmail.com'];
    if (clientEmail && clientEmail !== 'seanjevangelista@gmail.com') {
      recipients.push(clientEmail);
    }

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'EVAN Leads <leads@evanenterprise.com>',
          to: recipients,
          subject: emailSubject,
          html: emailHtml,
        }),
      });
    } catch (_) {
      // Email failure is non-fatal — lead is already logged
    }
  }

  return res.status(200).json({ ok: true, lead: insertedLead });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractEmail(str = '') {
  const m = str.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/);
  return m ? m[0].toLowerCase() : null;
}

function extractPhone(text = '') {
  const m = text.match(/(\+?1?\s?)?(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})/);
  return m ? m[0].trim() : null;
}

function extractName(text = '') {
  // LSA emails typically say "Customer name: John Smith" or "New lead from John Smith"
  const patterns = [
    /customer\s+name[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /new lead from\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /contact[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractService(text = '') {
  const m = text.match(/service(?:\s+requested)?[:\s]+([^\n.]+)/i);
  return m ? m[1].trim() : null;
}

function detectLeadType(subject = '', text = '') {
  const combined = (subject + ' ' + text).toLowerCase();
  if (combined.includes('message') || combined.includes('text')) return 'message';
  if (combined.includes('call') || combined.includes('phone')) return 'call';
  return 'call';
}

function buildNotes({ subject, bodyText, rawFrom, service }) {
  const lines = [];
  if (subject)  lines.push(`Subject: ${subject}`);
  if (rawFrom)  lines.push(`From: ${rawFrom}`);
  if (service)  lines.push(`Service: ${service}`);
  if (bodyText) lines.push(`\n--- Email Body ---\n${bodyText.slice(0, 800)}`);
  return lines.join('\n');
}

function buildEmailHtml({ clientName, customerName, customerPhone, leadType, service, today, notesSummary }) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:Inter,sans-serif;background:#F8FAFC;padding:32px;color:#0F172A">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #E2E8F0;overflow:hidden">
    <div style="background:#0F172A;padding:20px 28px">
      <div style="color:#fff;font-weight:700;font-size:16px">EVAN Enterprises</div>
      <div style="color:#94A3B8;font-size:12px;margin-top:2px">New LSA Lead Notification</div>
    </div>
    <div style="padding:24px 28px">
      <h2 style="margin:0 0 4px;font-size:18px">New Lead — ${clientName}</h2>
      <p style="color:#64748B;font-size:13px;margin:0 0 20px">${today}</p>

      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="border-bottom:1px solid #F1F5F9">
          <td style="padding:8px 0;color:#64748B;width:40%">Customer Name</td>
          <td style="padding:8px 0;font-weight:500">${customerName}</td>
        </tr>
        ${customerPhone ? `<tr style="border-bottom:1px solid #F1F5F9">
          <td style="padding:8px 0;color:#64748B">Phone</td>
          <td style="padding:8px 0;font-weight:500">${customerPhone}</td>
        </tr>` : ''}
        <tr style="border-bottom:1px solid #F1F5F9">
          <td style="padding:8px 0;color:#64748B">Lead Type</td>
          <td style="padding:8px 0;font-weight:500;text-transform:capitalize">${leadType}</td>
        </tr>
        ${service ? `<tr style="border-bottom:1px solid #F1F5F9">
          <td style="padding:8px 0;color:#64748B">Service</td>
          <td style="padding:8px 0;font-weight:500">${service}</td>
        </tr>` : ''}
      </table>

      <div style="margin-top:20px;background:#F8FAFC;border-radius:6px;padding:14px;font-size:12px;color:#475569;white-space:pre-wrap">${notesSummary.slice(0, 600)}</div>

      <a href="https://evan-enterprises-os.vercel.app/dashboard" style="display:inline-block;margin-top:20px;background:#0F172A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500">View in Dashboard →</a>
    </div>
  </div>
</body>
</html>`;
}
