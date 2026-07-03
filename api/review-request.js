// api/review-request.js
// Sends a Google review request email to a customer after a job is completed
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { clientId, customerName, customerEmail, customerPhone, jobDescription, googleReviewLink } = req.body || {};
  const resendKey   = process.env.RESEND_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!resendKey || !supabaseKey)  return res.status(500).json({ error: 'Missing env vars' });
  if (!clientId)                   return res.status(400).json({ error: 'clientId required' });
  if (!customerEmail)              return res.status(400).json({ error: 'customerEmail required' });

  const reviewLink = googleReviewLink || 'https://search.google.com/local/writereview?placeid=';

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  // Fetch client business name
  const clientRes = await fetch(
    `${supabaseUrl}/rest/v1/clients?id=eq.${clientId}&select=business_name`,
    { headers }
  );
  const [client] = await clientRes.json();
  const businessName = client?.business_name || 'your service provider';

  const firstName = customerName ? customerName.split(' ')[0] : 'there';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#F1F5F9;font-family:Inter,-apple-system,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto">

  <div style="background:#0A0F1E;border-radius:12px 12px 0 0;padding:22px 28px;display:flex;align-items:center;gap:12px">
    <svg width="28" height="23" viewBox="0 0 104 84" xmlns="http://www.w3.org/2000/svg">
      <path d="M 0,20 L 14,0 L 86,0 Q 104,0 104,10 Q 104,20 86,20 Z" fill="#3B82F6"/>
      <path d="M 0,52 L 14,32 L 86,32 Q 104,32 104,42 Q 104,52 86,52 Z" fill="#2563EB"/>
      <path d="M 0,84 L 14,64 L 86,64 Q 104,64 104,74 Q 104,84 86,84 Z" fill="#1D4ED8"/>
    </svg>
    <div style="color:#fff;font-size:13px;font-weight:700;letter-spacing:0.12em">${businessName.toUpperCase()}</div>
  </div>

  <div style="background:#fff;padding:32px 28px;border:1px solid #E2E8F0;border-top:none">
    <div style="font-size:22px;font-weight:700;color:#0F172A;margin-bottom:8px">How did we do?</div>
    <div style="font-size:13px;color:#374151;line-height:1.8;margin-bottom:28px">
      Hi ${firstName},<br><br>
      Thank you so much for choosing ${businessName}${jobDescription ? ` for ${jobDescription}` : ''}. It was a pleasure working with you, and we truly appreciate your business.<br><br>
      If you had a great experience, we'd love it if you could take 60 seconds to leave us a Google review. Reviews help us grow and let others know what to expect — it means the world to a small local business like ours.
    </div>

    <div style="text-align:center;margin-bottom:28px">
      <a href="${reviewLink}" style="display:inline-block;background:#1D4ED8;color:#fff;font-size:15px;font-weight:700;padding:16px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.01em">
        ⭐ Leave a Google Review
      </a>
    </div>

    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px 20px;font-size:12px;color:#64748B;line-height:1.6">
      Takes less than 60 seconds · No account required on some devices · Your feedback helps us improve
    </div>

    <div style="margin-top:24px;padding-top:20px;border-top:1px solid #F1F5F9;font-size:13px;color:#374151;line-height:1.7">
      Thank you again, ${firstName}. We hope to work with you again soon!<br><br>
      — Sean &amp; the ${businessName} team
    </div>
  </div>

  <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:14px 28px;font-size:11px;color:#94A3B8;text-align:center">
    ${businessName} · Managed by Evan Enterprises LLC
  </div>

</div>
</body></html>`;

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    `Sean @ Evan Enterprises <reviews@evanenterprise.com>`,
        to:      [customerEmail],
        cc:      ['seanjevangelista@gmail.com'],
        subject: `How did we do? — ${businessName}`,
        html,
      }),
    });
    const data = await emailRes.json();
    if (!data.id) return res.status(500).json({ error: 'Resend error', detail: data });
    return res.status(200).json({ ok: true, emailId: data.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
