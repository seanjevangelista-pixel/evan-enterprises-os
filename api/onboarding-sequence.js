// api/onboarding-sequence.js
// Sends the 3-email onboarding sequence for a new client
// Email 1: Welcome (immediate) — handled by welcome-email.js
// Email 2: Week 1 check-in (call this 7 days after onboarding)
// Email 3: Month 1 results (call this 30 days after onboarding)
// POST { clientId, emailNumber } where emailNumber is 2 or 3

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { clientId, emailNumber } = req.body || {};
  const resendKey   = process.env.RESEND_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL    || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!resendKey)    return res.status(500).json({ error: 'RESEND_API_KEY not set' });
  if (!clientId)     return res.status(400).json({ error: 'clientId required' });
  if (![2, 3].includes(Number(emailNumber))) return res.status(400).json({ error: 'emailNumber must be 2 or 3' });

  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };
  const clientRes = await fetch(`${supabaseUrl}/rest/v1/clients?id=eq.${clientId}&select=*`, { headers });
  const [client]  = await clientRes.json();

  if (!client)           return res.status(404).json({ error: 'Client not found' });
  if (!client.owner_email) return res.status(200).json({ ok: false, reason: 'No email on file' });

  const firstName = client.owner_name ? client.owner_name.split(' ')[0] : 'there';
  const baseUrl   = 'https://evan-enterprises-os.vercel.app';

  // Pull this month's stats for email 3
  let callCount = 0, lsaCount = 0;
  if (emailNumber === 3) {
    const moStart = new Date();
    moStart.setDate(1); moStart.setHours(0,0,0,0);
    const safe = p => p.then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => []);
    const [calls, lsa] = await Promise.all([
      safe(fetch(`${supabaseUrl}/rest/v1/call_leads?client_id=eq.${clientId}&tapped_at=gte.${moStart.toISOString()}&select=id`, { headers })),
      safe(fetch(`${supabaseUrl}/rest/v1/lsa_leads?client_id=eq.${clientId}&created_at=gte.${moStart.toISOString()}&select=id`, { headers })),
    ]);
    callCount = calls.length;
    lsaCount  = lsa.length;
  }

  const emails = {
    2: {
      subject: `Week 1 check-in — how's everything going?`,
      headline: `One week in — let's make sure everything is set up right.`,
      body: `Hi ${firstName},<br><br>
It's been about a week since we got started and I wanted to check in personally.<br><br>
By now you should have received your welcome packet and your client portal login. Here's what's been happening behind the scenes this week:<br><br>
<strong>✓ Your account is fully set up</strong> in our system<br>
<strong>✓ Lead tracking is live</strong> — we'll capture every call and contact form<br>
<strong>✓ Monthly reports are scheduled</strong> — you'll get your first one at the end of the month<br><br>
If you have any questions at all, or if anything feels off, just reply to this email. I personally read every response.<br><br>
Looking forward to building something great together.`,
      cta: { text: 'View Your Portal', url: `${baseUrl}/portal` },
    },
    3: {
      subject: `Your first month with Evan Enterprises — here's what happened`,
      headline: `One month in — here's the results so far.`,
      body: `Hi ${firstName},<br><br>
One month ago you joined Evan Enterprises and I want to share what's happened since then.<br><br>
<div style="display:flex;gap:12px;margin:20px 0;flex-wrap:wrap">
  <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:14px 18px;flex:1;min-width:120px;text-align:center">
    <div style="font-size:28px;font-weight:700;color:#15803D">${callCount + lsaCount}</div>
    <div style="font-size:11px;color:#64748B;margin-top:4px">Total Leads</div>
  </div>
  <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:14px 18px;flex:1;min-width:120px;text-align:center">
    <div style="font-size:28px;font-weight:700;color:#1D4ED8">${callCount}</div>
    <div style="font-size:11px;color:#64748B;margin-top:4px">Website Calls</div>
  </div>
  <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:14px 18px;flex:1;min-width:120px;text-align:center">
    <div style="font-size:28px;font-weight:700;color:#1D4ED8">${lsaCount}</div>
    <div style="font-size:11px;color:#64748B;margin-top:4px">LSA Leads</div>
  </div>
</div>
This is just month one — these numbers grow as your online presence builds authority over time.<br><br>
I'll keep pushing. If there's anything you want to focus on more, just reply and let me know.`,
      cta: { text: 'See Full Report', url: `${baseUrl}/portal` },
    },
  };

  const { subject, headline, body, cta } = emails[emailNumber];

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#F1F5F9;font-family:Inter,-apple-system,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto">

  <div style="background:#0A0F1E;border-radius:12px 12px 0 0;padding:22px 28px;display:flex;align-items:center;gap:14px">
    <svg width="28" height="23" viewBox="0 0 104 84" xmlns="http://www.w3.org/2000/svg">
      <path d="M 0,20 L 14,0 L 86,0 Q 104,0 104,10 Q 104,20 86,20 Z" fill="#3B82F6"/>
      <path d="M 0,52 L 14,32 L 86,32 Q 104,32 104,42 Q 104,52 86,52 Z" fill="#2563EB"/>
      <path d="M 0,84 L 14,64 L 86,64 Q 104,64 104,74 Q 104,84 86,84 Z" fill="#1D4ED8"/>
    </svg>
    <div style="color:#fff;font-size:13px;font-weight:700;letter-spacing:0.12em">EVAN ENTERPRISES LLC</div>
  </div>

  <div style="background:#fff;padding:28px;border:1px solid #E2E8F0;border-top:none">
    <div style="font-size:18px;font-weight:700;color:#0F172A;margin-bottom:16px">${headline}</div>
    <div style="font-size:13px;color:#374151;line-height:1.8;margin-bottom:24px">${body}</div>
    <div style="text-align:center">
      <a href="${cta.url}" style="display:inline-block;background:#1D4ED8;color:#fff;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none">${cta.text}</a>
    </div>
  </div>

  <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:14px 28px;font-size:11px;color:#94A3B8;text-align:center">
    Evan Enterprises LLC · seanjevangelista@gmail.com
  </div>

</div>
</body></html>`;

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'Sean @ Evan Enterprises <sean@evanenterprise.com>',
        to:      [client.owner_email],
        cc:      ['seanjevangelista@gmail.com'],
        subject: `${client.business_name} — ${subject}`,
        html,
      }),
    });
    const data = await emailRes.json();
    return res.status(200).json({ ok: !!data.id, emailNumber, emailId: data.id });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
