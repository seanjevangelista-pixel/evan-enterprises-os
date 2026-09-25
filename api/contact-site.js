// api/contact-site.js — Vercel serverless function
// Receives contact form submissions from evanenterprise.com and client sites
// that share this endpoint, and emails the right inbox via Resend — see
// RECIPIENTS_BY_BUSINESS below for per-client routing.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, business, phone, email, service, message, city, propertyType, budget } = req.body || {};

  if (!name || !email || !service) {
    return res.status(400).json({ error: 'Missing required fields: name, email, service' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Recipient is chosen from this server-side map, never from the request body —
  // this endpoint is public and unauthenticated, so trusting a client-supplied
  // "to" address would turn it into an open relay for spam to arbitrary inboxes.
  const RECIPIENTS_BY_BUSINESS = {
    'Legacy Hardscape ATX': ['legacyhardscapeatx@gmail.com'],
  };
  const to = RECIPIENTS_BY_BUSINESS[business] || ['seanjevangelista@gmail.com'];

  // escHtml() below only guards the HTML body — subject and reply_to are not
  // HTML, so escaping quotes/angle-brackets does nothing for them. A CR/LF in
  // name/business/email reaches Resend as part of a header field, which is
  // exactly what email header injection (adding a bogus Bcc/Content-Type/etc.
  // line) needs. Strip line breaks before anything goes into a header.
  // (Same class of bug already fixed in the client-site copies of this
  // endpoint — Premier Landscaping ATX and Mediterranean Spa.)
  const stripCrlf = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim();

  const subject = `New inquiry from ${stripCrlf(name)}${business ? ` — ${stripCrlf(business)}` : ''}`;

  // A malformed reply_to (this endpoint is public and unauthenticated, so a raw
  // POST can send anything regardless of the form's type="email" validation)
  // makes Resend reject the whole request with a 422 — the entire notification,
  // not just the reply-to header, silently never reaches Sean. Only set reply_to
  // when the address is well formed; the address is still shown in the email
  // body either way. Same fix already applied to Premier Landscaping ATX's and
  // Mediterranean Spa's copies of this endpoint — missed here.
  const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())
    ? stripCrlf(email)
    : undefined;

  const html = `
    <div style="font-family: Inter, sans-serif; max-width: 560px; color: #0F172A;">
      <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 4px; color: #0F172A;">
        New website inquiry
      </h2>
      <p style="font-size: 13px; color: #94A3B8; margin-bottom: 28px; margin-top: 0;">
        Submitted via evanenterprise.com
      </p>

      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #E2E8F0; color: #64748B; width: 130px;">Name</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #E2E8F0; font-weight: 500;">${escHtml(name)}</td>
        </tr>
        ${business ? `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #E2E8F0; color: #64748B;">Business</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #E2E8F0; font-weight: 500;">${escHtml(business)}</td>
        </tr>` : ''}
        ${phone ? `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #E2E8F0; color: #64748B;">Phone</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #E2E8F0;">${escHtml(phone)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #E2E8F0; color: #64748B;">Email</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #E2E8F0;"><a href="mailto:${escHtml(email)}" style="color: #1D4ED8;">${escHtml(email)}</a></td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #E2E8F0; color: #64748B;">Interested in</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #E2E8F0; font-weight: 500; color: #1D4ED8;">${escHtml(service)}</td>
        </tr>
        ${city ? `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #E2E8F0; color: #64748B;">City / Area</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #E2E8F0;">${escHtml(city)}</td>
        </tr>` : ''}
        ${propertyType ? `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #E2E8F0; color: #64748B;">Property Type</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #E2E8F0;">${escHtml(propertyType)}</td>
        </tr>` : ''}
        ${budget ? `
        <tr>
          <td style="padding: 10px 0; ${message ? 'border-bottom: 1px solid #E2E8F0;' : ''} color: #64748B;">Estimated Budget</td>
          <td style="padding: 10px 0; ${message ? 'border-bottom: 1px solid #E2E8F0;' : ''}">${escHtml(budget)}</td>
        </tr>` : ''}
        ${message ? `
        <tr>
          <td style="padding: 10px 0; color: #64748B; vertical-align: top;">Message</td>
          <td style="padding: 10px 0; line-height: 1.6;">${escHtml(message)}</td>
        </tr>` : ''}
      </table>

      <div style="margin-top: 28px; padding: 16px 20px; background: #F8FAFC; border-radius: 8px; border: 1px solid #E2E8F0;">
        <p style="font-size: 13px; color: #475569; margin: 0;">
          Reply directly to this email to respond to ${escHtml(name)}.
        </p>
      </div>
    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Evan Enterprises Website <noreply@evanenterprise.com>',
        to,
        reply_to: replyTo,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Email delivery failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('contact-site error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
