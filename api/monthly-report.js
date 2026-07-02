// api/monthly-report.js
// Triggered manually from dashboard "Send Monthly Report" button
// Pulls current-month stats from Supabase + Square, emails summary to Sean via Resend
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Allow dashboard trigger (no cron key needed — just any POST with the header)
  const internalKey = req.headers['x-internal-key'];
  if (!internalKey) return res.status(401).json({ error: 'Unauthorized' });

  const resendKey      = process.env.RESEND_API_KEY;
  const supabaseUrl    = process.env.SUPABASE_URL    || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
  const supabaseAnon   = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  const squareToken    = process.env.SQUARE_ACCESS_TOKEN;

  if (!resendKey) return res.status(200).json({ configured: false, missing: 'RESEND_API_KEY' });

  const now      = new Date();
  const moStart  = new Date(now.getFullYear(), now.getMonth(), 1);
  const moEnd    = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const moLabel  = moStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const today    = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // ── Pull Supabase data ──────────────────────────────────────────────────
  let activeClients = 0, totalClients = 0, callLeads = 0, visitCount = 0, visitRevenue = 0, myFees = 0;

  if (supabaseAnon) {
    try {
      const headers = {
        apikey: supabaseAnon,
        Authorization: `Bearer ${supabaseAnon}`,
        'Content-Type': 'application/json',
      };

      const [clientsRes, visitsRes, callsRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/clients?select=status,monthly_flat_fee`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/visits?select=visit_date,amount,fee_amount,count_for_fee&visit_date=gte.${moStart.toISOString().split('T')[0]}&visit_date=lte.${moEnd.toISOString().split('T')[0]}`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/call_leads?select=id&tapped_at=gte.${moStart.toISOString()}`, { headers }),
      ]);

      const clientData = await clientsRes.json();
      const visitData  = await visitsRes.json();
      const callData   = await callsRes.json();

      if (Array.isArray(clientData)) {
        totalClients  = clientData.length;
        activeClients = clientData.filter(c => c.status === 'active').length;
        myFees += clientData.filter(c => c.status === 'active').reduce((s, c) => s + Number(c.monthly_flat_fee || 0), 0);
      }
      if (Array.isArray(visitData)) {
        visitCount   = visitData.length;
        visitRevenue = visitData.reduce((s, v) => s + Number(v.amount || 0), 0);
        myFees      += visitData.reduce((s, v) => s + Number(v.fee_amount || 0), 0);
      }
      if (Array.isArray(callData)) callLeads = callData.length;
    } catch (_) {}
  }

  // ── Pull Square payments ────────────────────────────────────────────────
  let squareTotal = 0, squareTx = 0;
  if (squareToken) {
    try {
      const params = new URLSearchParams({
        begin_time: moStart.toISOString(),
        end_time:   now.toISOString(),
        limit:      '200',
      });
      const r = await fetch(`https://connect.squareup.com/v2/payments?${params}`, {
        headers: { Authorization: `Bearer ${squareToken}`, 'Square-Version': '2024-01-18' },
      });
      const d = await r.json();
      (d.payments || []).forEach(p => {
        squareTotal += (p.total_money?.amount || 0) / 100;
        squareTx++;
      });
    } catch (_) {}
  }

  // ── Build HTML email ────────────────────────────────────────────────────
  const stat = (label, value, color = '#0F172A') =>
    `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:18px 20px">
      <div style="font-size:10px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${label}</div>
      <div style="font-size:22px;font-weight:700;color:${color};letter-spacing:-0.5px">${value}</div>
    </div>`;

  const fmt = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px;background:#F1F5F9;font-family:Inter,-apple-system,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto">

  <!-- Header -->
  <div style="background:#0F172A;border-radius:12px 12px 0 0;padding:28px 32px;display:flex;align-items:center;gap:16px">
    <svg width="36" height="29" viewBox="0 0 104 84" xmlns="http://www.w3.org/2000/svg">
      <path d="M 0,20 L 14,0 L 86,0 Q 104,0 104,10 Q 104,20 86,20 Z" fill="#3B82F6"/>
      <path d="M 0,52 L 14,32 L 86,32 Q 104,32 104,42 Q 104,52 86,52 Z" fill="#2563EB"/>
      <path d="M 0,84 L 14,64 L 86,64 Q 104,64 104,74 Q 104,84 86,84 Z" fill="#1D4ED8"/>
    </svg>
    <div>
      <div style="color:#FFFFFF;font-size:15px;font-weight:700;letter-spacing:0.1em">EVAN ENTERPRISES LLC</div>
      <div style="color:#64748B;font-size:11px;margin-top:2px">Monthly Operations Report</div>
    </div>
  </div>

  <!-- Body -->
  <div style="background:#FFFFFF;padding:32px;border:1px solid #E2E8F0;border-top:none">
    <div style="font-size:20px;font-weight:700;color:#0F172A;margin-bottom:4px">${moLabel} Report</div>
    <div style="color:#64748B;font-size:13px;margin-bottom:28px">Generated ${today} · Evan Enterprises LLC</div>

    <div style="font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">Client Overview</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px">
      ${stat('Active Clients', activeClients, '#1D4ED8')}
      ${stat('Total Clients', totalClients)}
      ${stat('Visits This Month', visitCount)}
      ${stat('Website Call Taps', callLeads, '#059669')}
    </div>

    <div style="font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px">Revenue & Fees</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px">
      ${stat('Client Revenue (tracked)', fmt(visitRevenue), '#059669')}
      ${stat('My Fees This Month', fmt(myFees), '#059669')}
      ${squareToken ? stat('Square Collected', fmt(squareTotal), '#059669') : ''}
      ${squareToken ? stat('Square Transactions', squareTx) : ''}
    </div>

    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:16px 20px;font-size:13px;color:#1E40AF;line-height:1.6">
      This report was generated from your Evan Enterprises dashboard. Log in to see the full breakdown, manage clients, or generate a PDF invoice.
    </div>
  </div>

  <!-- Footer -->
  <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:18px 32px;font-size:11px;color:#94A3B8;text-align:center">
    Evan Enterprises LLC · seanjevangelista@gmail.com · Confidential
  </div>

</div>
</body></html>`;

  // ── Send via Resend ─────────────────────────────────────────────────────
  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'Evan Enterprises <reports@evanenterprise.com>',
        to:      ['seanjevangelista@gmail.com'],
        subject: `${moLabel} Operations Report — Evan Enterprises`,
        html,
      }),
    });
    const emailData = await emailRes.json();
    if (emailData.id) {
      return res.status(200).json({ ok: true, month: moLabel, emailId: emailData.id });
    } else {
      return res.status(500).json({ error: emailData.message || 'Resend error', detail: emailData });
    }
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
