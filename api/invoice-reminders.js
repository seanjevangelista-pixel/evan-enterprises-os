// api/invoice-reminders.js
// Checks unpaid invoices and sends reminder emails at 3 days before, due day, and 3 days overdue
// Called by EVAN's nightly scheduled task or manually from dashboard
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const resendKey   = process.env.RESEND_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL  || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!resendKey || !supabaseKey) return res.status(500).json({ error: 'Missing env vars' });

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  // Fetch all unpaid invoices with client info
  const invRes = await fetch(
    `${supabaseUrl}/rest/v1/invoices?select=*,clients(business_name,owner_name,owner_email)&status=eq.unpaid`,
    { headers }
  );
  const invoices = await invRes.json();
  if (!Array.isArray(invoices)) return res.status(500).json({ error: 'Failed to fetch invoices' });

  const today     = new Date();
  today.setHours(0, 0, 0, 0);
  const results   = [];

  for (const inv of invoices) {
    if (!inv.due_date) continue;
    const client = inv.clients;
    if (!client?.owner_email) continue;

    const due      = new Date(inv.due_date);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

    // Only act on -3, 0, +3 day marks
    let subject, bodyHeadline, bodyMessage, isOverdue = false;

    if (diffDays === 3) {
      subject      = `Friendly reminder — Invoice due in 3 days`;
      bodyHeadline = 'Your invoice is due in 3 days';
      bodyMessage  = `Just a heads up that your invoice from Evan Enterprises is due on <strong>${due.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>. No action needed if you've already taken care of it.`;
    } else if (diffDays === 0) {
      subject      = `Invoice due today — ${client.business_name}`;
      bodyHeadline = 'Your invoice is due today';
      bodyMessage  = `Your invoice from Evan Enterprises is due <strong>today</strong>. Please reach out if you have any questions or need to make alternate arrangements.`;
    } else if (diffDays === -3) {
      subject      = `Invoice past due — Action needed`;
      bodyHeadline = 'Your invoice is 3 days past due';
      bodyMessage  = `Your invoice from Evan Enterprises was due on <strong>${due.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong> and is now 3 days overdue. Please reply to this email or contact Sean directly to get this resolved.`;
      isOverdue    = true;

      // Mark invoice as overdue in Supabase
      await fetch(`${supabaseUrl}/rest/v1/invoices?id=eq.${inv.id}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'overdue' }),
      });
    } else {
      continue; // Not a reminder day
    }

    const amount = `$${Number(inv.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    const accentColor = isOverdue ? '#DC2626' : '#1D4ED8';
    const bgColor     = isOverdue ? '#FEF2F2' : '#EFF6FF';
    const borderColor = isOverdue ? '#FECACA' : '#BFDBFE';
    const textColor   = isOverdue ? '#991B1B' : '#1E40AF';

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#F1F5F9;font-family:Inter,-apple-system,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto">

  <div style="background:#0A0F1E;border-radius:12px 12px 0 0;padding:22px 28px;display:flex;align-items:center;gap:12px">
    <svg width="28" height="23" viewBox="0 0 104 84" xmlns="http://www.w3.org/2000/svg">
      <path d="M 0,20 L 14,0 L 86,0 Q 104,0 104,10 Q 104,20 86,20 Z" fill="#3B82F6"/>
      <path d="M 0,52 L 14,32 L 86,32 Q 104,32 104,42 Q 104,52 86,52 Z" fill="#2563EB"/>
      <path d="M 0,84 L 14,64 L 86,64 Q 104,64 104,74 Q 104,84 86,84 Z" fill="#1D4ED8"/>
    </svg>
    <div style="color:#fff;font-size:13px;font-weight:700;letter-spacing:0.12em">EVAN ENTERPRISES LLC</div>
  </div>

  <div style="background:#fff;padding:28px;border:1px solid #E2E8F0;border-top:none">
    <div style="font-size:18px;font-weight:700;color:#0F172A;margin-bottom:16px">${bodyHeadline}</div>
    <div style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:20px">
      Hi ${client.owner_name || 'there'},<br><br>
      ${bodyMessage}
    </div>

    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:18px 20px;margin-bottom:20px">
      <div style="font-size:10px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Invoice Details</div>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="font-size:13px;color:#64748B;padding:4px 0">Invoice</td>
          <td style="font-size:13px;color:#0F172A;font-weight:500;text-align:right">${inv.title || 'Invoice'}</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#64748B;padding:4px 0">Amount Due</td>
          <td style="font-size:18px;font-weight:700;color:${accentColor};text-align:right">${amount}</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#64748B;padding:4px 0">Due Date</td>
          <td style="font-size:13px;color:#0F172A;font-weight:500;text-align:right">${due.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td>
        </tr>
      </table>
    </div>

    <div style="background:${bgColor};border:1px solid ${borderColor};border-radius:8px;padding:14px 18px;font-size:13px;color:${textColor};line-height:1.6">
      Questions? Reply to this email or contact Sean directly at <strong>seanjevangelista@gmail.com</strong>
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
          from:    'Sean @ Evan Enterprises <invoices@evanenterprise.com>',
          to:      [client.owner_email],
          cc:      ['seanjevangelista@gmail.com'],
          subject: `${client.business_name} — ${subject}`,
          html,
        }),
      });
      const data = await emailRes.json();
      results.push({
        invoice: inv.title || inv.id,
        client: client.business_name,
        diffDays,
        ok: !!data.id,
        emailId: data.id,
      });
    } catch(e) {
      results.push({ invoice: inv.id, client: client.business_name, error: e.message });
    }
  }

  const sent = results.filter(r => r.ok).length;
  return res.status(200).json({ ok: true, checked: invoices.length, sent, results });
}
