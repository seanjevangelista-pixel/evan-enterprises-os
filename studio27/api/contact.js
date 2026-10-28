export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

  const { name, email, phone, company, date, project, budget, message, source } = req.body || {};

  if (!name || !email || (!message && !project)) {
    return res.status(400).json({ error: 'Name, email, and a message or service are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const rows = [
    ['Name', name],
    ['Email', email],
    ['Phone', phone],
    ['Source', source],
    ['Company', company],
    ['Target date', date],
    ['Project type', project],
    ['Budget', budget]
  ].filter(([, v]) => v);

  const html =
    '<div style="font-family:sans-serif;font-size:15px;color:#111">' +
    '<h2 style="margin:0 0 16px">New enquiry from studio27atx.com</h2>' +
    '<table cellpadding="6" cellspacing="0">' +
    rows.map(([k, v]) => `<tr><td style="color:#666"><strong>${esc(k)}</strong></td><td>${esc(v)}</td></tr>`).join('') +
    '</table>' +
    (message ? '<p style="margin-top:20px"><strong>Message</strong><br>' + esc(message).replace(/\n/g, '<br>') + '</p>' : '') +
    '</div>';

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Studio 27 Website <contact@studio27atx.com>',
        to: 'studio27.atx@gmail.com',
        reply_to: email,
        subject: `${source ? 'Booking request' : 'Project enquiry'} — ${String(name).replace(/[\r\n]+/g, ' ').trim()}`,
        html
      })
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend error', resendRes.status, errText);
      return res.status(502).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact form send failed', err);
    return res.status(502).json({ error: 'Failed to send email' });
  }
}
