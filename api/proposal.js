// api/proposal.js
// Generates a branded service proposal and emails it to Sean (and optionally the prospect)
// POST { prospectName, prospectEmail?, city, niche, services[], monthlyBudget?, notes? }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prospectName, prospectEmail, city, niche, services = [], monthlyBudget, notes } = req.body || {};
  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey)      return res.status(500).json({ error: 'RESEND_API_KEY not set' });
  if (!prospectName)   return res.status(400).json({ error: 'prospectName required' });

  const today     = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const refNum    = 'EE-' + Date.now().toString(36).toUpperCase().slice(-6);
  const budget    = monthlyBudget ? `$${Number(monthlyBudget).toLocaleString()}` : 'TBD';

  const serviceDetails = {
    website:    { label: 'Website Design & Development', desc: 'Professional, mobile-optimized website built to convert visitors into leads. SEO-ready from day one.', price: '$1,500 one-time' },
    google_ads: { label: 'Google Ads Management',        desc: 'Paid search campaigns targeting customers actively searching for your service. We handle setup, copy, and optimization.', price: '$300/mo + ad spend' },
    lsa:        { label: 'Local Service Ads (LSA)',       desc: 'Google-Guaranteed badge puts you at the very top of search results. Pay per lead, not per click.', price: '$200/mo setup' },
    seo:        { label: 'SEO & Local Rankings',          desc: 'Rank organically for high-intent keywords in your area. Google Business Profile optimization included.', price: '$250/mo' },
    jobber:     { label: 'Jobber Operations Management',  desc: 'Full Jobber setup and ongoing management — scheduling, quoting, invoicing, and customer follow-ups.', price: '$150/mo' },
    social:     { label: 'Social Media Management',       desc: 'Consistent posting across Instagram and Facebook. Content creation, scheduling, and engagement.', price: '$200/mo' },
    reviews:    { label: 'Review Generation',             desc: 'Automated review requests after every job. More 5-star reviews = more trust = more leads.', price: '$100/mo' },
    reporting:  { label: 'Monthly Reporting',             desc: 'Monthly performance report showing leads, revenue, and ROI — so you always know what\'s working.', price: 'Included' },
  };

  const selectedServices = services.length
    ? services.map(s => serviceDetails[s] || { label: s, desc: '', price: 'TBD' })
    : Object.values(serviceDetails);

  const serviceRows = selectedServices.map(s => `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #F1F5F9;vertical-align:top">
        <div style="font-size:13px;font-weight:600;color:#0F172A;margin-bottom:3px">${s.label}</div>
        <div style="font-size:12px;color:#64748B;line-height:1.5">${s.desc}</div>
      </td>
      <td style="padding:14px 0 14px 20px;border-bottom:1px solid #F1F5F9;vertical-align:top;text-align:right;white-space:nowrap">
        <span style="font-size:12px;font-weight:600;color:#1D4ED8">${s.price}</span>
      </td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#F1F5F9;font-family:Inter,-apple-system,Arial,sans-serif">
<div style="max-width:640px;margin:0 auto">

  <!-- Header -->
  <div style="background:#0A0F1E;border-radius:12px 12px 0 0;padding:28px 32px;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:14px">
      <svg width="32" height="26" viewBox="0 0 104 84" xmlns="http://www.w3.org/2000/svg">
        <path d="M 0,20 L 14,0 L 86,0 Q 104,0 104,10 Q 104,20 86,20 Z" fill="#3B82F6"/>
        <path d="M 0,52 L 14,32 L 86,32 Q 104,32 104,42 Q 104,52 86,52 Z" fill="#2563EB"/>
        <path d="M 0,84 L 14,64 L 86,64 Q 104,64 104,74 Q 104,84 86,84 Z" fill="#1D4ED8"/>
      </svg>
      <div>
        <div style="color:#fff;font-size:14px;font-weight:700;letter-spacing:0.12em">EVAN ENTERPRISES LLC</div>
        <div style="color:#64748B;font-size:11px;margin-top:2px">Service Proposal</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="color:#64748B;font-size:10px;letter-spacing:0.06em;text-transform:uppercase">Proposal #</div>
      <div style="color:#fff;font-size:13px;font-weight:600;margin-top:2px">${refNum}</div>
    </div>
  </div>

  <!-- Body -->
  <div style="background:#fff;padding:32px;border:1px solid #E2E8F0;border-top:none">

    <!-- Meta -->
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:28px;padding-bottom:24px;border-bottom:1px solid #F1F5F9">
      <div>
        <div style="font-size:10px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Prepared For</div>
        <div style="font-size:16px;font-weight:700;color:#0F172A">${prospectName}</div>
        <div style="font-size:12px;color:#64748B">${city || ''} ${niche ? '· ' + niche : ''}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Date</div>
        <div style="font-size:13px;color:#0F172A">${today}</div>
        <div style="font-size:10px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-top:10px;margin-bottom:4px">Est. Monthly Investment</div>
        <div style="font-size:16px;font-weight:700;color:#1D4ED8">${budget}</div>
      </div>
    </div>

    <!-- Intro -->
    <div style="font-size:13px;color:#374151;line-height:1.8;margin-bottom:24px">
      Thank you for the opportunity to present this proposal. Evan Enterprises LLC is a business management firm that handles the digital and operational side of growing businesses — so owners can stay focused on their craft.<br><br>
      Based on our conversation, here's what we recommend for <strong>${prospectName}</strong>:
    </div>

    <!-- Services -->
    <div style="font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">Proposed Services</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      ${serviceRows}
    </table>

    ${notes ? `
    <!-- Notes -->
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px 20px;margin-bottom:24px">
      <div style="font-size:10px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Additional Notes</div>
      <div style="font-size:13px;color:#374151;line-height:1.6">${notes}</div>
    </div>` : ''}

    <!-- Why Us -->
    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:18px 20px;margin-bottom:24px">
      <div style="font-size:13px;font-weight:600;color:#1E40AF;margin-bottom:8px">Why Evan Enterprises?</div>
      <div style="font-size:12px;color:#1E40AF;line-height:1.7">
        • One point of contact — Sean manages everything, no juggling vendors<br>
        • Monthly reports showing exactly what you're getting for your investment<br>
        • We currently manage Premier Landscaping ATX — full digital + operations<br>
        • No long-term contracts — we earn your business every month
      </div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;padding:20px 0">
      <div style="font-size:14px;font-weight:600;color:#0F172A;margin-bottom:8px">Ready to move forward?</div>
      <div style="font-size:13px;color:#64748B;margin-bottom:16px">Reply to this email or call/text Sean directly.</div>
      <a href="mailto:seanjevangelista@gmail.com" style="display:inline-block;background:#1D4ED8;color:#fff;padding:12px 28px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none">Accept Proposal</a>
    </div>

  </div>

  <!-- Footer -->
  <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;font-size:11px;color:#94A3B8;text-align:center">
    Evan Enterprises LLC · seanjevangelista@gmail.com · This proposal is valid for 30 days
  </div>

</div>
</body></html>`;

  const recipients = ['seanjevangelista@gmail.com'];
  if (prospectEmail) recipients.push(prospectEmail);

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'Sean @ Evan Enterprises <proposals@evanenterprise.com>',
        to:      recipients,
        subject: `Service Proposal for ${prospectName} — Evan Enterprises LLC`,
        html,
      }),
    });
    const data = await emailRes.json();
    return res.status(200).json({ ok: !!data.id, refNum, emailId: data.id, sentTo: recipients });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
