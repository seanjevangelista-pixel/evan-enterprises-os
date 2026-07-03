// api/health-check.js
// Checks all active clients for warning signs and emails Sean a health alert if any are found
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const resendKey   = process.env.RESEND_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!resendKey || !supabaseKey) return res.status(500).json({ error: 'Missing env vars' });

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  // Fetch all active clients
  const clientsRes = await fetch(
    `${supabaseUrl}/rest/v1/clients?status=eq.active&select=*`,
    { headers }
  );
  const clients = await clientsRes.json();
  if (!Array.isArray(clients)) return res.status(500).json({ error: 'Failed to fetch clients' });

  const now      = new Date();
  const ago30    = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ago14    = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch data needed for all checks in parallel
  const [callLeadsRes, lsaLeadsRes, invoicesRes, visitsRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/call_leads?select=client_id,created_at`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/lsa_leads?select=client_id,created_at`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/invoices?status=eq.unpaid&select=client_id,due_date`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/visits?select=client_id,visit_date`, { headers }),
  ]);

  const [callLeads, lsaLeads, invoices, visits] = await Promise.all([
    callLeadsRes.json(),
    lsaLeadsRes.json(),
    invoicesRes.json(),
    visitsRes.json(),
  ]);

  const flagged = [];

  for (const client of clients) {
    const warnings = [];

    // Check: no leads in 30 days
    const recentCallLead = Array.isArray(callLeads) && callLeads.find(
      l => l.client_id === client.id && l.created_at >= ago30
    );
    const recentLsaLead = Array.isArray(lsaLeads) && lsaLeads.find(
      l => l.client_id === client.id && l.created_at >= ago30
    );
    if (!recentCallLead && !recentLsaLead) {
      warnings.push({ flag: 'No leads in 30 days', action: 'Review ad spend and campaign status in Google Ads' });
    }

    // Check: unpaid invoice older than 14 days
    const overdueInvoice = Array.isArray(invoices) && invoices.find(
      i => i.client_id === client.id && i.due_date && i.due_date < ago14.slice(0, 10)
    );
    if (overdueInvoice) {
      warnings.push({ flag: 'Invoice overdue 14+ days', action: 'Follow up with client directly or send manual reminder' });
    }

    // Check: no visits logged in 30 days
    const recentVisit = Array.isArray(visits) && visits.find(
      v => v.client_id === client.id && v.visit_date >= ago30.slice(0, 10)
    );
    if (!recentVisit) {
      warnings.push({ flag: 'No activity logged', action: 'Log a visit or check in with the client' });
    }

    if (warnings.length) {
      flagged.push({ client, warnings });
    }
  }

  if (!flagged.length) {
    return res.status(200).json({ ok: true, healthy: true, checked: clients.length });
  }

  // Build alert email
  const clientRows = flagged.map(({ client, warnings }) => `
    <div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:20px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="font-size:14px;font-weight:700;color:#0F172A">${client.business_name}</div>
        <span style="font-size:11px;background:#FEF3C7;color:#92400E;border:1px solid #FDE68A;border-radius:4px;padding:2px 8px;font-weight:600">${warnings.length} warning${warnings.length > 1 ? 's' : ''}</span>
      </div>
      ${warnings.map(w => `
      <div style="display:flex;gap:12px;padding:10px 0;border-top:1px solid #F1F5F9">
        <div style="width:8px;height:8px;background:#F59E0B;border-radius:50%;margin-top:5px;flex-shrink:0"></div>
        <div>
          <div style="font-size:13px;font-weight:600;color:#0F172A">${w.flag}</div>
          <div style="font-size:11px;color:#64748B;margin-top:2px">Suggested action: ${w.action}</div>
        </div>
      </div>`).join('')}
    </div>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#F1F5F9;font-family:Inter,-apple-system,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto">

  <div style="background:#0A0F1E;border-radius:12px 12px 0 0;padding:22px 28px;display:flex;align-items:center;gap:12px">
    <svg width="28" height="23" viewBox="0 0 104 84" xmlns="http://www.w3.org/2000/svg">
      <path d="M 0,20 L 14,0 L 86,0 Q 104,0 104,10 Q 104,20 86,20 Z" fill="#3B82F6"/>
      <path d="M 0,52 L 14,32 L 86,32 Q 104,32 104,42 Q 104,52 86,52 Z" fill="#2563EB"/>
      <path d="M 0,84 L 14,64 L 86,64 Q 104,64 104,74 Q 104,84 86,84 Z" fill="#1D4ED8"/>
    </svg>
    <div>
      <div style="color:#fff;font-size:13px;font-weight:700;letter-spacing:0.12em">EVAN ENTERPRISES — HEALTH ALERT</div>
      <div style="color:#64748B;font-size:11px;margin-top:2px">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>
  </div>

  <div style="background:#FEF3C7;border:1px solid #FDE68A;border-top:none;padding:14px 28px;display:flex;align-items:center;gap:10px">
    <div style="font-size:18px">⚠️</div>
    <div style="font-size:13px;font-weight:600;color:#92400E">${flagged.length} client${flagged.length > 1 ? 's' : ''} need${flagged.length === 1 ? 's' : ''} your attention</div>
  </div>

  <div style="background:#F8FAFC;padding:24px 28px;border:1px solid #E2E8F0;border-top:none">
    ${clientRows}
  </div>

  <div style="background:#fff;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:16px 28px;font-size:12px;color:#64748B;text-align:center">
    Auto-generated by EVAN · ${clients.length} active clients checked · Log in to <a href="https://evan-enterprises-os.vercel.app/dashboard" style="color:#1D4ED8">the dashboard</a> to take action
  </div>

</div>
</body></html>`;

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'EVAN <noreply@evanenterprise.com>',
        to:      ['seanjevangelista@gmail.com'],
        subject: `EVAN Health Alert — ${flagged.length} client${flagged.length > 1 ? 's' : ''} need attention`,
        html,
      }),
    });
    const data = await emailRes.json();
    return res.status(200).json({
      ok: true,
      healthy: false,
      checked: clients.length,
      flagged: flagged.length,
      emailId: data.id,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
