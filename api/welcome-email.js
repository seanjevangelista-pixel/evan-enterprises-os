// api/welcome-email.js
// Sends welcome packet email to a new client with their portal link and onboarding checklist to Sean
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { clientId, businessName, ownerName, ownerEmail } = req.body || {};
  const resendKey  = process.env.RESEND_API_KEY;
  const baseUrl    = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://evan-enterprises-os.vercel.app';

  if (!resendKey)    return res.status(500).json({ error: 'RESEND_API_KEY not set' });
  if (!ownerEmail)   return res.status(200).json({ ok: false, reason: 'No client email — skipping' });
  if (!businessName) return res.status(400).json({ error: 'businessName required' });

  const welcomeUrl  = `${baseUrl}/welcome?client=${encodeURIComponent(businessName)}`;
  const portalUrl   = `${baseUrl}/portal`;
  const greeting    = ownerName ? `Hi ${ownerName.split(' ')[0]},` : 'Hi there,';

  // ── Email to client ──────────────────────────────────────────────────
  const clientHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#F1F5F9;font-family:Inter,-apple-system,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto">

  <div style="background:#0A0F1E;border-radius:12px 12px 0 0;padding:24px 28px;display:flex;align-items:center;gap:14px">
    <svg width="32" height="26" viewBox="0 0 104 84" xmlns="http://www.w3.org/2000/svg">
      <path d="M 0,20 L 14,0 L 86,0 Q 104,0 104,10 Q 104,20 86,20 Z" fill="#3B82F6"/>
      <path d="M 0,52 L 14,32 L 86,32 Q 104,32 104,42 Q 104,52 86,52 Z" fill="#2563EB"/>
      <path d="M 0,84 L 14,64 L 86,64 Q 104,64 104,74 Q 104,84 86,84 Z" fill="#1D4ED8"/>
    </svg>
    <div>
      <div style="color:#fff;font-size:14px;font-weight:700;letter-spacing:0.12em">EVAN ENTERPRISES LLC</div>
      <div style="color:#64748B;font-size:11px;margin-top:2px">Welcome to the team</div>
    </div>
  </div>

  <div style="background:#fff;padding:28px;border:1px solid #E2E8F0;border-top:none">
    <div style="font-size:20px;font-weight:700;color:#0F172A;margin-bottom:16px">Welcome, ${businessName} 👋</div>
    <div style="font-size:13px;color:#374151;line-height:1.8;margin-bottom:24px">
      ${greeting}<br><br>
      We're excited to start working together. Evan Enterprises is now managing your business operations — so you can stay focused on what you do best.<br><br>
      Here's everything you need to get started:
    </div>

    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px">Your Resources</div>

      <a href="${welcomeUrl}" style="display:flex;align-items:center;gap:14px;padding:12px 16px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;text-decoration:none;margin-bottom:10px">
        <span style="font-size:20px">📋</span>
        <div>
          <div style="font-size:13px;font-weight:600;color:#1D4ED8">Welcome Packet</div>
          <div style="font-size:11px;color:#64748B;margin-top:2px">What we do, what to expect, and how to work with us</div>
        </div>
      </a>

      <a href="${portalUrl}" style="display:flex;align-items:center;gap:14px;padding:12px 16px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;text-decoration:none">
        <span style="font-size:20px">📊</span>
        <div>
          <div style="font-size:13px;font-weight:600;color:#15803D">Your Client Portal</div>
          <div style="font-size:11px;color:#64748B;margin-top:2px">Log in to see your leads, invoices, and performance</div>
        </div>
      </a>
    </div>

    <div style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:20px">
      You'll receive a monthly performance report on the 1st of every month showing exactly what's happening with your business.<br><br>
      Any questions at all — reply to this email or text Sean directly. We're always reachable.
    </div>

    <div style="background:#0A0F1E;border-radius:8px;padding:16px 20px;display:flex;align-items:center;gap:14px">
      <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#3B82F6);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px;flex-shrink:0">SE</div>
      <div>
        <div style="color:#fff;font-size:13px;font-weight:600">Sean Evangelista</div>
        <div style="color:#64748B;font-size:11px">Evan Enterprises LLC · seanjevangelista@gmail.com</div>
      </div>
    </div>
  </div>

  <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:14px 28px;font-size:11px;color:#94A3B8;text-align:center">
    Evan Enterprises LLC · seanjevangelista@gmail.com
  </div>

</div>
</body></html>`;

  // ── Onboarding checklist to Sean ─────────────────────────────────────
  const seanHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:32px 16px;background:#F1F5F9;font-family:Inter,-apple-system,Arial,sans-serif">
<div style="max-width:540px;margin:0 auto">
  <div style="background:#0A0F1E;border-radius:12px 12px 0 0;padding:20px 24px">
    <div style="color:#fff;font-size:13px;font-weight:700;letter-spacing:0.12em">EVAN ENTERPRISES — NEW CLIENT ALERT</div>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #E2E8F0;border-top:none">
    <div style="font-size:16px;font-weight:700;margin-bottom:4px">New client added: ${businessName}</div>
    <div style="font-size:12px;color:#64748B;margin-bottom:20px">${ownerName || ''} · ${ownerEmail}</div>

    <div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px">Onboarding Checklist</div>

    ${[
      ['Set up website', 'Buy domain, build or update their site'],
      ['Configure Google Business Profile', 'Claim and optimize their GBP listing'],
      ['Set up Google Ads', 'Create campaign, add customer ID to dashboard'],
      ['Apply for Local Service Ads', 'Get them Google-guaranteed'],
      ['Set up Jobber', 'Create account, configure services and scheduling'],
      ['Add Gmail filter for LSA emails', `Forward localhomeservices-noreply@google.com → leads@evanenterprise.com`],
      ['Configure DNS MX record', 'Add inbound.resend.com MX record on their domain'],
      ['Create portal account', 'Dashboard → Clients → Create Portal Account'],
      ['Send welcome packet', `Already sent to ${ownerEmail} ✓`],
      ['Schedule first check-in call', '30 days after onboarding'],
    ].map(([task, desc]) => `
    <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #F1F5F9">
      <div style="width:18px;height:18px;border:2px solid #CBD5E1;border-radius:4px;flex-shrink:0;margin-top:1px"></div>
      <div>
        <div style="font-size:13px;font-weight:500;color:#0F172A">${task}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${desc}</div>
      </div>
    </div>`).join('')}

  </div>
  <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:12px 24px;font-size:11px;color:#94A3B8;text-align:center">
    Auto-generated by EVAN when ${businessName} was added to your dashboard
  </div>
</div>
</body></html>`;

  const results = await Promise.all([
    // Welcome email to client
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'Sean @ Evan Enterprises <welcome@evanenterprise.com>',
        to:      [ownerEmail],
        subject: `Welcome to Evan Enterprises, ${businessName}!`,
        html:    clientHtml,
      }),
    }).then(r => r.json()).catch(e => ({ error: e.message })),

    // Onboarding checklist to Sean
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'EVAN <noreply@evanenterprise.com>',
        to:      ['seanjevangelista@gmail.com'],
        subject: `New client added: ${businessName} — Onboarding Checklist`,
        html:    seanHtml,
      }),
    }).then(r => r.json()).catch(e => ({ error: e.message })),
  ]);

  return res.status(200).json({
    ok: true,
    clientEmail: results[0],
    seanChecklist: results[1],
  });
}
