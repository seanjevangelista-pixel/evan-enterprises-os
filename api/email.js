// api/email.js — merged from client-report, health-check, invoice-reminders,
//                welcome-email, review-request, onboarding-sequence, proposal
// Route via: POST /api/email?action=client-report|health-check|invoice-reminders|...

// ── CLIENT-REPORT ──
// api/client-report.js
// Sends a branded monthly performance report to each active client
// POST { clientId?: string } — omit clientId to send to all active clients

async function handle_client_report(req, res) {
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

    // Services checklist — client.services is the JSONB map set via the dashboard's
    // Edit Client modal (keys: website, google_ads, jobber, social, gbp, invoicing, reporting).
    // (Previously read client.has_* boolean columns, which the dashboard never writes to.)
    const clientSvc = client.services || {};
    const services = [
      clientSvc.website    && 'Website',
      clientSvc.google_ads && 'Google Ads',
      clientSvc.jobber     && 'Jobber Management',
      clientSvc.social     && 'Social Media',
      clientSvc.gbp        && 'Google Business Profile',
      clientSvc.invoicing  && 'Invoicing',
      clientSvc.reporting  && 'Monthly Reporting',
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

// ── HEALTH-CHECK ──
// api/health-check.js
// Checks all active clients for warning signs and emails Sean a health alert if any are found

async function handle_health_check(req, res) {
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

// ── INVOICE-REMINDERS ──
// api/invoice-reminders.js
// Checks unpaid invoices and sends reminder emails at 3 days before, due day, and 3 days overdue
// Called by EVAN's nightly scheduled task or manually from dashboard

async function handle_invoice_reminders(req, res) {
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

// ── WELCOME-EMAIL ──
// api/welcome-email.js
// Sends welcome packet email to a new client with their portal link and onboarding checklist to Sean

async function handle_welcome_email(req, res) {
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

// ── REVIEW-REQUEST ──
// api/review-request.js
// Sends a Google review request email to a customer after a job is completed

async function handle_review_request(req, res) {
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

// ── ONBOARDING ──
// api/onboarding-sequence.js
// Sends the 3-email onboarding sequence for a new client
// Email 1: Welcome (immediate) — handled by welcome-email.js
// Email 2: Week 1 check-in (call this 7 days after onboarding)
// Email 3: Month 1 results (call this 30 days after onboarding)
// POST { clientId, emailNumber } where emailNumber is 2 or 3

async function handle_onboarding_sequence(req, res) {
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

// ── PROPOSAL ──
// api/proposal.js
// Generates a branded service proposal and emails it to Sean (and optionally the prospect)
// POST { prospectName, prospectEmail?, city, niche, services[], monthlyBudget?, notes? }

async function handle_proposal(req, res) {
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


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const action = req.query.action;
  if (action === 'client-report') return handle_client_report(req, res);
  if (action === 'health-check') return handle_health_check(req, res);
  if (action === 'invoice-reminders') return handle_invoice_reminders(req, res);
  if (action === 'welcome-email') return handle_welcome_email(req, res);
  if (action === 'review-request') return handle_review_request(req, res);
  if (action === 'onboarding') return handle_onboarding_sequence(req, res);
  if (action === 'proposal') return handle_proposal(req, res);
  return res.status(400).json({ error: 'Unknown action' });
}
