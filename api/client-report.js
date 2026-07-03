// api/client-report.js
// Sends a branded monthly performance report to each active client
// POST { clientId?: string } — omit clientId to send to all active clients
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const resendKey    = process.env.RESEND_API_KEY;
  const supabaseUrl  = process.env.SUPABASE_URL    || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
  const supabaseKey  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!resendKey || !supabaseKey) return res.status(500).json({ error: 'Missing env vars' });

  const { clientId } = req.body || {};

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  const now     = new Date();
  const moStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const moEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const moLabel = moStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const today   = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Fetch clients
  let clientQuery = `${supabaseUrl}/rest/v1/clients?select=*&status=eq.active`;
  if (clientId) clientQuery += `&id=eq.${clientId}`;
  const clientsRes = await fetch(clientQuery, { headers });
  const clients = await clientsRes.json();

  if (!Array.isArray(clients) || clients.length === 0) {
    return res.status(200).json({ ok: true, sent: 0, message: 'No active clients found' });
  }

  const results = [];

  for (const client of clients) {
    if (!client.owner_email) { results.push({ client: client.business_name, skipped: 'no email' }); continue; }

    // Pull this client's data for the month
    const [visitsRes, callsRes, lsaRes, invoicesRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/visits?select=visit_date,amount,notes&client_id=eq.${client.id}&visit_date=gte.${moStart.toISOString().split('T')[0]}&visit_date=lte.${moEnd.toISOString().split('T')[0]}`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/call_leads?select=id,tapped_at&client_id=eq.${client.id}&tapped_at=gte.${moStart.toISOString()}`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/lsa_leads?select=id,created_at,lead_type&client_id=eq.${client.id}&created_at=gte.${moStart.toISOString()}`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/invoices?select=amount,status,due_date&client_id=eq.${client.id}&status=eq.unpaid`, { headers }),
    ]);

    const visits   = await visitsRes.json().catch(() => []);
    const calls    = await callsRes.json().catch(() => []);
    const lsaLeads = await lsaRes.json().catch(() => []);
    const unpaidInvoices = await invoicesRes.json().catch(() => []);

    const visitCount    = Array.isArray(visits) ? visits.length : 0;
    const callCount     = Array.isArray(calls) ? calls.length : 0;
    const lsaCount      = Array.isArray(lsaLeads) ? lsaLeads.length : 0;
    const totalLeads    = callCount + lsaCount;
    const unpaidAmt     = Array.isArray(unpaidInvoices)
      ? unpaidInvoices.reduce((s, i) => s + Number(i.amount || 0), 0)
      : 0;

    // Services checklist (from client record)
    const services = [
      client.has_website     && 'Website',
      client.has_google_ads  && 'Google Ads',
      client.has_lsa         && 'Local Service Ads',
      client.has_jobber      && 'Jobber Management',
      client.has_seo         && 'SEO',
      client.has_social      && 'Social Media',
      client.has_reviews     && 'Review Generation',
      client.has_reporting   && 'Monthly Reporting',
    ].filter(Boolean);

    const serviceRows = services.length
      ? services.map(s => `<tr><td style="padding:6px 0;border-bottom:1px solid #F1F5F9;color:#374151;font-size:13px">✓ ${s}</td></tr>`).join('')
      : `<tr><td style="padding:6px 0;color:#94A3B8;font-size:13px">No services configured yet</td></tr>`;

    const stat = (label, value, color = '#0F172A') =>
      `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px 18px;flex:1;min-width:120px">
        <div style="font-size:10px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${label}</div>
        <div style="font-size:24px;font-weight:700;color:${color};letter-spacing:-0.5px">${value}</div>
      </div>`;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:#F1F5F9; font-family:Inter,-apple-system,Arial,sans-serif; padding:32px 16px; }
  .wrap { max-width:580px; margin:0 auto; }
</style>
</head><body>
<div class="wrap">

  <!-- Header -->
  <div style="background:#0A0F1E;border-radius:12px 12px 0 0;padding:24px 28px;display:flex;align-items:center;gap:14px">
    <svg width="32" height="26" viewBox="0 0 104 84" xmlns="http://www.w3.org/2000/svg">
      <path d="M 0,20 L 14,0 L 86,0 Q 104,0 104,10 Q 104,20 86,20 Z" fill="#3B82F6"/>
      <path d="M 0,52 L 14,32 L 86,32 Q 104,32 104,42 Q 104,52 86,52 Z" fill="#2563EB"/>
      <path d="M 0,84 L 14,64 L 86,64 Q 104,64 104,74 Q 104,84 86,84 Z" fill="#1D4ED8"/>
    </svg>
    <div>
      <div style="color:#fff;font-size:14px;font-weight:700;letter-spacing:0.12em">EVAN ENTERPRISES LLC</div>
      <div style="color:#64748B;font-size:11px;margin-top:2px">Monthly Performance Report</div>
    </div>
  </div>

  <!-- Body -->
  <div style="background:#fff;padding:28px;border:1px solid #E2E8F0;border-top:none">

    <div style="font-size:19px;font-weight:700;color:#0F172A;margin-bottom:4px">${moLabel} Update</div>
    <div style="color:#64748B;font-size:12px;margin-bottom:6px">Prepared for <strong>${client.business_name}</strong> · ${today}</div>
    <div style="color:#374151;font-size:13px;line-height:1.6;margin-bottom:24px">
      Hi ${client.owner_name || 'there'},<br><br>
      Here's your monthly performance summary from Evan Enterprises. We're tracking everything below so you can stay focused on what you do best.
    </div>

    <!-- Stats row -->
    <div style="font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">This Month's Results</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px">
      ${stat('Total Leads', totalLeads, totalLeads > 0 ? '#059669' : '#0F172A')}
      ${stat('Website Calls', callCount, callCount > 0 ? '#1D4ED8' : '#0F172A')}
      ${stat('LSA Leads', lsaCount, lsaCount > 0 ? '#059669' : '#0F172A')}
      ${stat('Jobs Tracked', visitCount)}
    </div>

    <!-- Services -->
    <div style="font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">What We're Managing For You</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      ${serviceRows}
    </table>

    ${unpaidAmt > 0 ? `
    <!-- Invoice alert -->
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:14px 18px;margin-bottom:24px;font-size:13px;color:#991B1B">
      <strong>Balance Due:</strong> $${unpaidAmt.toFixed(2)} — Please reach out if you have any questions about your invoice.
    </div>` : ''}

    <!-- CTA -->
    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:16px 18px;font-size:13px;color:#1E40AF;line-height:1.6">
      Questions or updates? Reply to this email or text Sean directly.<br>
      <strong>We're always working to grow your business.</strong>
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:16px 28px;font-size:11px;color:#94A3B8;text-align:center">
    Evan Enterprises LLC · seanjevangelista@gmail.com<br>
    You're receiving this because Evan Enterprises manages your digital operations.
  </div>

</div>
</body></html>`;

    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    'Sean @ Evan Enterprises <reports@evanenterprise.com>',
          to:      [client.owner_email],
          cc:      ['seanjevangelista@gmail.com'],
          subject: `${client.business_name} — ${moLabel} Performance Report`,
          html,
        }),
      });
      const data = await emailRes.json();
      results.push({ client: client.business_name, email: client.owner_email, ok: !!data.id, emailId: data.id });
    } catch(e) {
      results.push({ client: client.business_name, error: e.message });
    }
  }

  return res.status(200).json({ ok: true, month: moLabel, results });
}
