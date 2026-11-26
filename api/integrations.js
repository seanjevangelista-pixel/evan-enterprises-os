// api/integrations.js — merged from google-ads-auth, google-ads, jobber,
//                      lsa-check, monthly-report, outreach-send, square
// Route via: /api/integrations?action=google-ads-auth|google-ads|jobber|...

// ── GOOGLE-ADS-AUTH ──
const SUPABASE_URL      = process.env.SUPABASE_URL      || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
const SUPABASE_ANON     = process.env.SUPABASE_ANON     || 'sb_publishable_C6qf6KSBHv07VGTDNmpvZg_H0nnLrhR';
const SUPABASE_SERVICE  = process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON;
const REDIRECT_URI      = 'https://evan-enterprises-os.vercel.app/dashboard';
const MEDIA_BUCKET      = 'media';

// ── Supabase helpers ──
async function getSetting(key) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/settings?key=eq.${key}&select=value&limit=1`,
    { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
  );
  const rows = await r.json();
  return Array.isArray(rows) && rows.length ? rows[0].value : null;
}

async function upsertSetting(key, value) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/settings`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ key, value }),
    }
  );
}

async function handle_google_ads_auth(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { sub: action, code } = req.query;

  // ── GET ?action=url — return the OAuth authorization URL ──
  if (action === 'url') {
    const clientId = await getSetting('google_ads_client_id');
    if (!clientId) {
      return res.status(400).json({ error: 'google_ads_client_id not saved in Settings yet.' });
    }

    const params = new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  REDIRECT_URI,
      scope:         'https://www.googleapis.com/auth/adwords',
      response_type: 'code',
      access_type:   'offline',
      prompt:        'consent',
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return res.status(200).json({ url });
  }

  // ── GET ?action=token&code=XXX — exchange code for tokens ──
  if (action === 'token') {
    if (!code) return res.status(400).json({ error: 'code param required' });

    const clientId  = await getSetting('google_ads_client_id');
    const clientSec = await getSetting('google_ads_client_secret');

    if (!clientId || !clientSec) {
      return res.status(400).json({ error: 'client_id / client_secret not saved in Settings.' });
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSec,
        code,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description || tokenData.error });
    }

    const { refresh_token, access_token, id_token } = tokenData;

    if (!refresh_token) {
      return res.status(400).json({ error: 'No refresh_token returned — make sure prompt=consent was used.' });
    }

    // Get the connected Google account email from the id_token
    let googleEmail = null;
    if (id_token) {
      try {
        const payload = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64').toString());
        googleEmail = payload.email || null;
      } catch (_) {}
    }

    // Save refresh_token (and email) to Supabase settings table
    await upsertSetting('google_ads_refresh_token', refresh_token);
    if (googleEmail) {
      await upsertSetting('google_ads_connected_email', googleEmail);
    }

    return res.status(200).json({
      success: true,
      email: googleEmail,
      message: 'Google Ads connected successfully.',
    });
  }

  // ── GET ?action=status — check if connected ──
  if (action === 'status') {
    const refreshToken = await getSetting('google_ads_refresh_token');
    const email        = await getSetting('google_ads_connected_email');
    return res.status(200).json({
      connected: !!refreshToken,
      email: email || null,
    });
  }

  return res.status(400).json({ error: 'Unknown action. Use ?action=url, ?action=token, or ?action=status' });
}

// ── GOOGLE-ADS ──
async function handle_google_ads(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const customerId = (req.query.customer_id || '').replace(/-/g, '');
  if (!customerId) return res.status(400).json({ error: 'customer_id required' });

  // ── Read credentials: prefer env vars, fall back to Supabase settings table ──
  let devToken     = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  let clientId     = process.env.GOOGLE_ADS_CLIENT_ID;
  let clientSec    = process.env.GOOGLE_ADS_CLIENT_SECRET;
  let refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  let mccId        = process.env.GOOGLE_ADS_MCC_ID || '';

  if (!devToken || !clientId || !clientSec || !refreshToken) {
    // Try Supabase settings table
    const sbUrl  = process.env.SUPABASE_URL  || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
    const sbAnon = process.env.SUPABASE_ANON || 'sb_publishable_C6qf6KSBHv07VGTDNmpvZg_H0nnLrhR';
    try {
      const r = await fetch(
        `${sbUrl}/rest/v1/settings?key=in.(google_ads_developer_token,google_ads_client_id,google_ads_client_secret,google_ads_refresh_token,google_ads_mcc_id)&select=key,value`,
        { headers: { apikey: sbAnon, Authorization: `Bearer ${sbAnon}` } }
      );
      const rows = await r.json();
      if (Array.isArray(rows)) {
        const map = {};
        rows.forEach(row => { map[row.key] = row.value; });
        devToken     = devToken     || map['google_ads_developer_token'] || '';
        clientId     = clientId     || map['google_ads_client_id']       || '';
        clientSec    = clientSec    || map['google_ads_client_secret']   || '';
        refreshToken = refreshToken || map['google_ads_refresh_token']   || '';
        mccId        = mccId        || map['google_ads_mcc_id']          || '';
      }
    } catch (_) { /* ignore — fall through to configured:false */ }
  }

  if (!devToken || !clientId || !clientSec || !refreshToken) {
    return res.status(200).json({ configured: false });
  }

  try {
    // Step 1: Get access token via refresh token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSec,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }),
    });
    const { access_token, error: tokenErr } = await tokenRes.json();
    if (tokenErr || !access_token) {
      return res.status(401).json({ configured: true, error: 'OAuth failed: ' + (tokenErr || 'no access_token returned') });
    }

    const headers = {
      Authorization:     `Bearer ${access_token}`,
      'developer-token': devToken,
      'Content-Type':    'application/json',
    };
    // If using a manager (MCC) account, add login-customer-id header
    if (mccId) headers['login-customer-id'] = mccId.replace(/-/g, '');

    const { metric } = req.query; // campaigns | overview

    // ── Campaign performance (last 30 days) ──
    if (!metric || metric === 'campaigns') {
      const query = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc
        FROM campaign
        WHERE segments.date DURING LAST_30_DAYS
          AND campaign.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 20
      `;
      const r = await fetch(
        `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`,
        { method: 'POST', headers, body: JSON.stringify({ query }) }
      );
      const data = await r.json();
      if (data.error) return res.status(200).json({ configured: true, error: data.error.message || JSON.stringify(data.error) });
      return res.status(200).json({ configured: true, ...data });
    }

    // ── Overview summary ──
    if (metric === 'overview') {
      const query = `
        SELECT
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc
        FROM customer
        WHERE segments.date DURING LAST_30_DAYS
      `;
      const r = await fetch(
        `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`,
        { method: 'POST', headers, body: JSON.stringify({ query }) }
      );
      const data = await r.json();
      if (data.error) return res.status(200).json({ configured: true, error: data.error.message || JSON.stringify(data.error) });
      return res.status(200).json({ configured: true, ...data });
    }

    return res.status(400).json({ error: 'Unknown metric' });

  } catch (e) {
    return res.status(500).json({ configured: true, error: e.message });
  }
}

// ── JOBBER AUTH (generate OAuth URL) ──
async function handle_jobber_auth(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientId = process.env.JOBBER_CLIENT_ID;
  if (!clientId) return res.status(400).json({ error: 'JOBBER_CLIENT_ID not set in Vercel env vars' });

  const callbackUrl = 'https://evan-enterprises-os.vercel.app/api/integrations?action=jobber-callback';
  const url = `https://api.getjobber.com/api/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code`;
  return res.status(200).json({ url });
}

// ── JOBBER CALLBACK (exchange code for tokens) ──
async function handle_jobber_callback(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  const clientId     = process.env.JOBBER_CLIENT_ID;
  const clientSecret = process.env.JOBBER_CLIENT_SECRET;
  const callbackUrl  = 'https://evan-enterprises-os.vercel.app/api/integrations?action=jobber-callback';

  try {
    const tokenRes = await fetch('https://api.getjobber.com/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        code,
        redirect_uri:  callbackUrl,
        grant_type:    'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.refresh_token) return res.status(400).send('No refresh token returned: ' + JSON.stringify(tokenData));

    await upsertSetting('jobber_refresh_token', tokenData.refresh_token);
    if (tokenData.access_token) await upsertSetting('jobber_access_token', tokenData.access_token);

    return res.redirect(302, 'https://evan-enterprises-os.vercel.app/dashboard?jobber=connected');
  } catch (e) {
    return res.status(500).send('Jobber OAuth error: ' + e.message);
  }
}

// ── JOBBER ──
async function handle_jobber(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientId     = process.env.JOBBER_CLIENT_ID;
  const clientSecret = process.env.JOBBER_CLIENT_SECRET;
  // Try Supabase first (set by OAuth callback), fall back to env var
  const refreshToken = (await getSetting('jobber_refresh_token')) || process.env.JOBBER_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return res.status(200).json({ configured: false });
  }

  try {
    // Step 1: exchange refresh token for access token
    const tokenRes = await fetch('https://api.getjobber.com/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }),
    });
    let tokenData;
    try { tokenData = await tokenRes.json(); } catch(_) {
      return res.status(401).json({ configured: true, error: 'OAuth failed: Jobber returned a non-JSON response (status ' + tokenRes.status + ')' });
    }
    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(401).json({ configured: true, error: 'OAuth failed: ' + (tokenData.error_description || tokenData.error || 'unknown') });
    }
    const accessToken = tokenData.access_token;
    // Rotation: save new refresh token if Jobber issued one
    if (tokenData.refresh_token) await upsertSetting('jobber_refresh_token', tokenData.refresh_token);

    // Step 2: GraphQL query — jobs, invoices, quotes last 30 days
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const query = `
      query DashboardData {
        jobs(filter: { startAt: { gte: "${since}" } }, first: 50) {
          nodes {
            id
            title
            jobStatus
            startAt
            total
            client { name }
          }
        }
        invoices(filter: { issuedDate: { gte: "${since}" } }, first: 50) {
          nodes {
            id
            invoiceNumber
            status
            issuedDate
            total
            client { name }
          }
        }
        quotes(filter: { createdAt: { gte: "${since}" } }, first: 50) {
          nodes {
            id
            quoteNumber
            status
            createdAt
            total
            client { name }
          }
        }
      }
    `;

    const gqlRes = await fetch('https://api.getjobber.com/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-JOBBER-GRAPHQL-VERSION': '2024-10-07',
      },
      body: JSON.stringify({ query }),
    });

    const gqlData = await gqlRes.json();
    if (gqlData.errors) {
      return res.status(400).json({ configured: true, error: gqlData.errors[0]?.message });
    }

    const d = gqlData.data || {};
    return res.status(200).json({
      configured: true,
      jobs:     d.jobs?.nodes     || [],
      invoices: d.invoices?.nodes || [],
      quotes:   d.quotes?.nodes   || [],
    });

  } catch (e) {
    return res.status(500).json({ configured: true, error: e.message });
  }
}

// ── LSA-CHECK ──
// api/lsa-check.js
// Scheduled stub for checking a Gmail inbox for forwarded LSA lead emails.
//
// TODO: To enable Gmail polling, you will need:
//   1. A Google Cloud project with the Gmail API enabled
//   2. OAuth 2.0 credentials (client ID + secret) stored as env vars:
//        GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
//   3. A dedicated Gmail address (e.g. leads@evanenterprise.com) that receives
//      forwarded LSA notification emails from clients
//   4. Logic to:
//      a. Exchange refresh token for access token via Google OAuth token endpoint
//      b. Call Gmail API: GET /gmail/v1/users/me/messages?q=is:unread label:lsa-leads
//      c. For each unread message, fetch full message body
//      d. POST to /api/lsa-webhook with { to, from, subject, text } payload
//      e. Mark messages as read after processing
//
// Until Gmail polling is configured, use webhook forwarding instead:
//   Forward LSA emails to leads@evanenterprise.com and Resend will
//   POST them to https://evan-enterprises-os.vercel.app/api/lsa-webhook


async function handle_lsa_check(req, res) {
  return res.status(200).json({
    ok: true,
    message: 'Gmail polling not yet configured — use webhook forwarding instead',
    instructions: {
      step1: 'In Gmail or Google LSA settings, set up email forwarding to leads@evanenterprise.com',
      step2: 'In Resend dashboard, configure inbound email routing for leads@evanenterprise.com',
      step3: 'Set the webhook destination to https://evan-enterprises-os.vercel.app/api/lsa-webhook',
      step4: 'Leads will auto-appear in the dashboard LSA Leads tab',
    },
  });
}

// ── MONTHLY-REPORT ──
// api/monthly-report.js
// Triggered manually from dashboard "Send Monthly Report" button
// Pulls current-month stats from Supabase + Square, emails summary to Sean via Resend

async function handle_monthly_report(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Allow dashboard trigger (no cron key needed — just any POST with the header).
  //
  // This only checked that the header was PRESENT, not that its value matched
  // anything — so any caller could satisfy it with a junk value, no knowledge
  // of the dashboard's actual 'dashboard' value required. Require the real
  // shared value (matches the check agent.js already uses).
  if (!(await isAdmin(req))) return res.status(401).json({ error: 'Unauthorized' });

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
  // ListPayments returns every status, so declined cards and voided auths were
  // being summed as revenue, and it caps a page at 100, so a busy month was cut
  // off. Same fix as the client report in api/agent.js: COMPLETED only, all pages.
  let squareTotal = 0, squareTx = 0;
  if (squareToken) {
    try {
      let cursor = null, pages = 0;
      do {
        const params = new URLSearchParams({
          begin_time: moStart.toISOString(),
          end_time:   now.toISOString(),
          limit:      '100',
        });
        if (cursor) params.set('cursor', cursor);
        const r = await fetch(`https://connect.squareup.com/v2/payments?${params}`, {
          headers: { Authorization: `Bearer ${squareToken}`, 'Square-Version': '2024-01-18' },
        });
        const d = await r.json();
        if (!r.ok) { console.error('Square payments fetch failed:', r.status, d.errors?.[0]?.detail); break; }
        (d.payments || []).forEach(p => {
          if (p.status !== 'COMPLETED') return;
          squareTotal += (p.total_money?.amount || 0) / 100;
          squareTx++;
        });
        cursor = d.cursor || null;
      } while (cursor && ++pages < 50);
    } catch (e) { console.error('Square payments fetch threw:', e.message); }
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

// ── OUTREACH ──
// api/outreach-send.js
// Sends personalized cold emails to a list of prospects and logs them in Supabase.
//
// SQL to create the outreach_leads table in Supabase:
// -----------------------------------------------------------------------------
// create table if not exists outreach_leads (
//   id uuid primary key default gen_random_uuid(),
//   business_name text not null,
//   owner_name text,
//   email text not null,
//   phone text,
//   city text,
//   niche text,
//   pain_point text,
//   status text default 'pending', -- pending, sent, replied, converted, unsubscribed
//   notes text,
//   last_emailed_at timestamptz,
//   follow_up_count int default 0,
//   created_at timestamptz default now()
// );
// -----------------------------------------------------------------------------


function buildInitialEmail({ businessName, ownerName, city, niche, painPoint }) {
  const firstName = ownerName ? ownerName.split(' ')[0] : 'there';
  const nicheLabel = niche || 'home service';
  const cityLabel  = city  || 'your area';
  const pain       = painPoint || 'losing calls to voicemail because there\'s no easy way for customers to book online';

  const subject = `A booking page for ${businessName}`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#F1F5F9;font-family:Inter,-apple-system,Arial,sans-serif">
<div style="max-width:540px;margin:0 auto">

  <div style="background:#0A0F1E;border-radius:12px 12px 0 0;padding:20px 24px;display:flex;align-items:center;gap:14px">
    <svg width="28" height="22" viewBox="0 0 104 84" xmlns="http://www.w3.org/2000/svg">
      <path d="M 0,20 L 14,0 L 86,0 Q 104,0 104,10 Q 104,20 86,20 Z" fill="#3B82F6"/>
      <path d="M 0,52 L 14,32 L 86,32 Q 104,32 104,42 Q 104,52 86,52 Z" fill="#2563EB"/>
      <path d="M 0,84 L 14,64 L 86,64 Q 104,64 104,74 Q 104,84 86,84 Z" fill="#1D4ED8"/>
    </svg>
    <div>
      <div style="color:#fff;font-size:13px;font-weight:700;letter-spacing:0.12em">EVAN ENTERPRISES LLC</div>
      <div style="color:#94A3B8;font-size:11px;margin-top:2px">Websites & Booking Systems for Local Service Businesses</div>
    </div>
  </div>

  <div style="background:#fff;padding:28px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px">
    <p style="font-size:14px;color:#0F172A;line-height:1.7;margin:0 0 16px">Hey ${firstName},</p>

    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px">
      I came across <strong>${businessName}</strong> while looking at ${nicheLabel} businesses in ${cityLabel} — wanted to reach out directly.
    </p>

    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px">
      Most ${nicheLabel} businesses in ${cityLabel} are ${pain}. That's a fixable problem, not a "hire more staff" problem.
    </p>

    <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:8px;padding:18px 20px;margin:20px 0">
      <div style="font-size:12px;font-weight:700;color:#0369A1;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px">$1,500 — Website + Booking System</div>
      <p style="font-size:13px;color:#0F172A;line-height:1.7;margin:0">
        A custom website for ${businessName} with a <strong>bookings page synced to your email and Google Calendar</strong> — customers pick a time that actually works, no phone tag — plus a <strong>"Call Me Now" button</strong> right on the page for anyone who wants to skip straight to a call.
      </p>
    </div>

    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px">
      If you also want to show up when people search for ${nicheLabel} in ${cityLabel}, I can set that up too:
    </p>

    <ul style="font-size:13px;color:#374151;line-height:1.9;margin:0 0 20px;padding-left:20px">
      <li>Google Business Profile setup — <strong>$500</strong> one-time</li>
      <li>Local Service Ads management — <strong>$500 setup, $250/mo</strong></li>
    </ul>

    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 20px">
      No pressure on the add-ons — the $1,500 site + booking system stands on its own. Worth a quick 15-min call this week to see if it's a fit?
    </p>

    <div style="border-top:1px solid #E2E8F0;padding-top:20px;display:flex;align-items:center;gap:14px">
      <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#3B82F6);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px;flex-shrink:0">SE</div>
      <div>
        <div style="font-size:13px;font-weight:600;color:#0F172A">Sean Evangelista</div>
        <div style="font-size:12px;color:#64748B">Evan Enterprises LLC</div>
        <div style="font-size:12px;color:#64748B">sean@evanenterprise.com</div>
      </div>
    </div>

    <p style="font-size:11px;color:#94A3B8;line-height:1.6;margin:20px 0 0;border-top:1px solid #E2E8F0;padding-top:14px">
      Not interested? Just reply and let me know — I won't follow up again.
    </p>
  </div>

</div>
</body></html>`;

  return { subject, html };
}

function buildFollowUpEmail({ businessName, ownerName, city }) {
  const firstName = ownerName ? ownerName.split(' ')[0] : 'there';
  const cityLabel  = city || 'your area';

  const subject = `Re: A booking page for ${businessName}`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#F1F5F9;font-family:Inter,-apple-system,Arial,sans-serif">
<div style="max-width:540px;margin:0 auto">
  <div style="background:#fff;padding:28px;border:1px solid #E2E8F0;border-radius:12px">
    <p style="font-size:14px;color:#0F172A;line-height:1.7;margin:0 0 14px">Hey ${firstName},</p>
    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 14px">
      Just wanted to follow up on my last email — I know inboxes get busy.
    </p>
    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 14px">
      Quick recap: $1,500 gets ${businessName} a custom website with a booking page synced to your calendar and a Call Me Now button, so customers in ${cityLabel} can reach you without the phone tag. Happy to show you an example — worth a quick call?
    </p>
    <div style="border-top:1px solid #E2E8F0;padding-top:18px;display:flex;align-items:center;gap:12px">
      <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#3B82F6);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:13px;flex-shrink:0">SE</div>
      <div>
        <div style="font-size:13px;font-weight:600;color:#0F172A">Sean — Evan Enterprises LLC</div>
        <div style="font-size:12px;color:#64748B">sean@evanenterprise.com</div>
      </div>
    </div>
    <p style="font-size:11px;color:#94A3B8;line-height:1.6;margin:18px 0 0;border-top:1px solid #E2E8F0;padding-top:14px">
      Not interested? Just reply and let me know — I won't follow up again.
    </p>
  </div>
</div>
</body></html>`;

  return { subject, html };
}

// Sends the initial/follow-up outreach email to each lead via Resend and
// upserts the result into outreach_leads. Shared by the manual dashboard
// send and the daily outreach-cron.
async function sendOutreachBatch(leads, followUp, resendKey, supabaseUrl, supabaseKey) {
  const results = [];
  let sent = 0;

  for (const lead of leads) {
    const { businessName, ownerName, email, city, niche, painPoint } = lead;
    if (!email || !businessName) {
      results.push({ email, ok: false, error: 'Missing email or businessName' });
      continue;
    }

    const { subject, html } = followUp
      ? buildFollowUpEmail({ businessName, ownerName, city })
      : buildInitialEmail({ businessName, ownerName, city, niche, painPoint });

    // Send via Resend
    let emailResult;
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    'Sean Evangelista <sean@evanenterprise.com>',
          to:      [email],
          subject,
          html,
        }),
      });
      emailResult = await r.json();
    } catch (e) {
      emailResult = { error: e.message };
    }

    // Resend reports a rejection as { statusCode, name, message } with no `error`
    // key, so checking !emailResult.error counted every rejected send as sent. The
    // lead was then marked 'sent' without ever getting the first email, and got a
    // "following up" email 4 days later (or nothing at all, if that one failed too).
    const emailOk = !!emailResult.id;
    if (emailOk) sent++;
    else console.error('Outreach send failed:', email, emailResult.message || emailResult.error);

    // Upsert lead in Supabase. Only after a real send: a failed lead keeps its
    // current status, so the next cron run retries it.
    if (supabaseKey && emailOk) {
      try {
        const now = new Date().toISOString();
        // Try update first (by email), then insert if not found
        const upsertRes = await fetch(`${supabaseUrl}/rest/v1/outreach_leads?email=eq.${encodeURIComponent(email)}`, {
          method: 'PATCH',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            status: 'sent',
            last_emailed_at: now,
            ...(followUp ? { follow_up_count: 1 } : {}),
          }),
        });

        const updated = await upsertRes.json();

        if (!updated || (Array.isArray(updated) && updated.length === 0)) {
          // No existing row — insert new
          await fetch(`${supabaseUrl}/rest/v1/outreach_leads`, {
            method: 'POST',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({
              business_name: businessName,
              owner_name: ownerName || null,
              email,
              city: city || null,
              niche: niche || null,
              pain_point: painPoint || null,
              status: 'sent',
              last_emailed_at: now,
              follow_up_count: followUp ? 1 : 0,
            }),
          });
        }
      } catch (e) {
        // Non-fatal — email already sent
        console.error('Supabase upsert error:', e.message);
      }
    }

    results.push({ email, businessName, ok: emailOk, resend: emailResult });
  }

  return { sent, results };
}

async function handle_outreach_send(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Same guard as monthly-report — this endpoint fires real emails from
  // Sean's domain, so it can't be left open to any caller. Requires the value
  // to actually match (not just be present) — see monthly-report above.
  if (!(await isAdmin(req))) return res.status(401).json({ error: 'Unauthorized' });

  const { leads = [], followUp = false } = req.body || {};
  if (!leads.length) return res.status(400).json({ error: 'No leads provided' });

  const resendKey   = process.env.RESEND_API_KEY;
  const supabaseUrl = SUPABASE_URL;
  const supabaseKey = SUPABASE_SERVICE;

  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY not set' });

  const { sent, results } = await sendOutreachBatch(leads, followUp, resendKey, supabaseUrl, supabaseKey);

  return res.status(200).json({ ok: true, sent, results });
}

// ── OUTREACH-CRON ──
// Triggered daily by Vercel Cron (see vercel.json). Sends the next batch of
// pending leads, then a single follow-up to leads that went quiet for 4+
// days. Capped per run to protect deliverability on a single domain.
const OUTREACH_DAILY_BATCH_SIZE = 25;
const OUTREACH_FOLLOWUP_DELAY_DAYS = 4;

async function handle_outreach_cron(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  // If CRON_SECRET was never set in Vercel, `cronSecret && ...` short-circuited to
  // false and skipped the check entirely — leaving this endpoint (fires real cold-
  // outreach emails from Sean's domain to every pending/stale lead in Supabase, no
  // method restriction) wide open to any caller on the internet. Same "unset secret
  // means wide open by default" gap already fixed for api/agent.js's handle_agent_report
  // — require the secret to actually be configured and match.
  if (!cronSecret || req.headers['authorization'] !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const resendKey   = process.env.RESEND_API_KEY;
  const supabaseUrl = SUPABASE_URL;
  const supabaseKey = SUPABASE_SERVICE;

  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY not set' });

  const mapRow = row => ({
    businessName: row.business_name,
    ownerName: row.owner_name,
    email: row.email,
    city: row.city,
    niche: row.niche,
    painPoint: row.pain_point,
  });

  // Batch 1: never-contacted leads
  const pendingRes = await fetch(
    `${supabaseUrl}/rest/v1/outreach_leads?status=eq.pending&order=created_at.asc&limit=${OUTREACH_DAILY_BATCH_SIZE}`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  const pendingRows = await pendingRes.json();
  const pendingLeads = (Array.isArray(pendingRows) ? pendingRows : []).map(mapRow);
  const initial = pendingLeads.length
    ? await sendOutreachBatch(pendingLeads, false, resendKey, supabaseUrl, supabaseKey)
    : { sent: 0, results: [] };

  // Batch 2: leads sent 4+ days ago with no follow-up yet
  const cutoff = new Date(Date.now() - OUTREACH_FOLLOWUP_DELAY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const staleRes = await fetch(
    `${supabaseUrl}/rest/v1/outreach_leads?status=eq.sent&follow_up_count=eq.0&last_emailed_at=lt.${cutoff}&order=last_emailed_at.asc&limit=${OUTREACH_DAILY_BATCH_SIZE}`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
  );
  const staleRows = await staleRes.json();
  const staleLeads = (Array.isArray(staleRows) ? staleRows : []).map(mapRow);
  const followUps = staleLeads.length
    ? await sendOutreachBatch(staleLeads, true, resendKey, supabaseUrl, supabaseKey)
    : { sent: 0, results: [] };

  return res.status(200).json({
    ok: true,
    initialSent: initial.sent,
    followUpsSent: followUps.sent,
  });
}

// ── MEDIA UPLOAD ──
// Handles images (<4.5MB via base64) and videos (signed URL for direct upload)
async function ensureMediaBucket() {
  // Create bucket if it doesn't exist
  await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE,
      Authorization: `Bearer ${SUPABASE_SERVICE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id: MEDIA_BUCKET, name: MEDIA_BUCKET, public: true }),
  });
}

async function handle_media(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Had no auth check — sub=upload writes arbitrary files straight into
  // Sean's Supabase storage bucket with no auth, and sub=sign hands out a
  // signed upload URL for the same. Same guard as the rest of this file.
  if (!(await isAdmin(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { sub } = req.query;

  // POST ?action=media&sub=upload — upload image as base64
  // Body: { filename, contentType, data: base64string }
  if (sub === 'upload') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
    const { filename, contentType, data } = req.body || {};
    if (!filename || !contentType || !data) return res.status(400).json({ error: 'filename, contentType, and data (base64) required' });

    try {
      await ensureMediaBucket();
      const bytes = Buffer.from(data, 'base64');
      const path  = `${Date.now()}-${filename}`;
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path}`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE,
          Authorization: `Bearer ${SUPABASE_SERVICE}`,
          'Content-Type': contentType,
        },
        body: bytes,
      });
      if (!r.ok) {
        const err = await r.json();
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
      return res.status(200).json({ ok: true, url: publicUrl, path });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST ?action=media&sub=sign — get a signed upload URL for large videos (bypass Vercel 4.5MB limit)
  // Body: { filename, contentType }
  if (sub === 'sign') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
    const { filename, contentType } = req.body || {};
    if (!filename || !contentType) return res.status(400).json({ error: 'filename and contentType required' });

    try {
      await ensureMediaBucket();
      const path = `${Date.now()}-${filename}`;
      const r = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${MEDIA_BUCKET}/${path}`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE,
          Authorization: `Bearer ${SUPABASE_SERVICE}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ upsert: false }),
      });
      const result = await r.json();
      if (!r.ok) return res.status(400).json({ error: result.message || 'Failed to create signed URL' });
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
      return res.status(200).json({
        ok: true,
        signedUrl: `${SUPABASE_URL}${result.url}`,
        token: result.token,
        publicUrl,
        path,
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Unknown sub-action. Use: upload, sign' });
}

// ── BUFFER ──
// Posting + analytics through Buffer's GraphQL API (https://developers.buffer.com).
//   BUFFER_ACCESS_TOKEN  personal API key (Authorization: Bearer). Reading post metrics
//                        requires a personal key — OAuth app clients can't read metrics.
//   BUFFER_ORG_ID        optional; falls back to the org id below.
// Every value that comes from a request goes in as a GraphQL variable, never into the query
// text, so nothing a caller sends can change the shape of the query.
const BUFFER_TOKEN = process.env.BUFFER_ACCESS_TOKEN;
const BUFFER_ORG_ID = process.env.BUFFER_ORG_ID || '6a52f6662ab024a3a8c01a78';

// The five networks the clip pipeline publishes to.
const CLIP_SERVICES = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin'];

async function bufferGQL(query, variables = {}) {
  const r = await fetch('https://api.buffer.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${BUFFER_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(25000),
  });
  if (r.status === 429) {
    const e = new Error('Buffer rate limit reached — try again later');
    e.status = 429;
    throw e;
  }
  let body;
  try { body = await r.json(); } catch (e) { throw new Error(`Buffer returned HTTP ${r.status} with no JSON body`); }
  if (body.errors?.length) {
    const e = new Error(body.errors[0].message || 'Buffer API error');
    e.status = 400;
    throw e;
  }
  return body.data;
}

async function bufferChannels() {
  const d = await bufferGQL(
    `query($input: ChannelsInput!) { channels(input: $input) { id name displayName service type isDisconnected isLocked } }`,
    { input: { organizationId: BUFFER_ORG_ID } }
  );
  return d?.channels || [];
}

// Network-specific settings for a short vertical clip.
function clipMetadata(service, title) {
  switch (service) {
    case 'instagram': return { instagram: { type: 'reel', shouldShareToFeed: true } };
    case 'facebook':  return { facebook: { type: 'reel' } };
    case 'tiktok':    return { tiktok: {} };
    case 'youtube':   return { youtube: { type: 'short', title: String(title).slice(0, 100), categoryId: '22' } };
    case 'linkedin':  return { linkedin: {} };
    default:          return undefined;
  }
}

// Instagram personal profiles and Facebook groups can only send a reminder, not auto-publish.
function schedulingTypeFor(channel) {
  const personalIG = channel.service === 'instagram' && channel.type === 'profile';
  const fbGroup    = channel.service === 'facebook' && channel.type === 'group';
  return personalIG || fbGroup ? 'notification' : 'automatic';
}

async function bufferCreatePost(input) {
  const d = await bufferGQL(
    `mutation($input: CreatePostInput!) {
       createPost(input: $input) {
         ... on PostActionSuccess { post { id status dueAt channelId channelService } }
         ... on MutationError { message }
       }
     }`,
    { input }
  );
  const out = d?.createPost;
  if (out?.post) return { ok: true, post: out.post };
  return { ok: false, error: out?.message || 'Buffer did not return a post' };
}

const isHttpsUrl = (u) => { try { return new URL(u).protocol === 'https:'; } catch (e) { return false; } };

// Pull one metric value out of Buffer's [{type, value, unit}] list.
function metricValue(metrics, type) {
  const m = (metrics || []).find(x => x.type === type);
  return m ? Number(m.value) : null;
}

// Sent posts (with metrics) -> rows in public.social_posts. Run supabase/social-analytics.sql first.
async function bufferSync(days) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const rows = [];
  let after = null, pages = 0, hasNext = true;
  while (hasNext && pages++ < 10) {
    const d = await bufferGQL(
      `query($input: PostsInput!, $first: Int, $after: String) {
         posts(first: $first, after: $after, input: $input) {
           edges { node { id text channelId channelService status sentAt externalLink metricsUpdatedAt metrics { type value unit } } }
           pageInfo { hasNextPage endCursor }
         }
       }`,
      { first: 100, after, input: { organizationId: BUFFER_ORG_ID, filter: { status: ['sent'], startDate: since } } }
    );
    const conn = d?.posts;
    for (const { node: p } of conn?.edges || []) {
      rows.push({
        buffer_post_id: p.id,
        channel_id: p.channelId,
        service: p.channelService,
        text: (p.text || '').slice(0, 2000),
        sent_at: p.sentAt,
        external_link: p.externalLink,
        views: metricValue(p.metrics, 'views'),
        impressions: metricValue(p.metrics, 'impressions'),
        reach: metricValue(p.metrics, 'reach'),
        reactions: metricValue(p.metrics, 'reactions'),
        comments: metricValue(p.metrics, 'comments'),
        shares: metricValue(p.metrics, 'shares'),
        saves: metricValue(p.metrics, 'saves'),
        engagement_rate: metricValue(p.metrics, 'engagementRate'),
        metrics: p.metrics || [],
        metrics_updated_at: p.metricsUpdatedAt,
        synced_at: new Date().toISOString(),
      });
    }
    hasNext = !!conn?.pageInfo?.hasNextPage;
    after = conn?.pageInfo?.endCursor || null;
  }
  if (rows.length) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/social_posts?on_conflict=buffer_post_id`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE, Authorization: `Bearer ${SUPABASE_SERVICE}`,
        'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    });
    if (!r.ok) throw new Error(`Supabase save failed (${r.status}): ${(await r.text()).slice(0, 300)}. Did you run supabase/social-analytics.sql?`);
  }
  return { synced: rows.length, pages, since };
}

async function handle_buffer(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { sub } = req.query;

  // Everything here either publishes to Sean's social accounts or reads their stats, so it is
  // admin-only. The daily sync cron is the one exception: Vercel sends CRON_SECRET as a bearer.
  const cronSecret = process.env.CRON_SECRET;
  const cronOk = sub === 'sync' && !!cronSecret && req.headers.authorization === `Bearer ${cronSecret}`;
  if (!cronOk && !(await isAdmin(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // GET ?action=buffer&sub=analytics&days=30 — rollups from the saved metrics (no Buffer call)
    if (sub === 'analytics') {
      const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/social_posts?sent_at=gte.${encodeURIComponent(since)}&select=*&order=sent_at.desc&limit=1000`,
        { headers: { apikey: SUPABASE_SERVICE, Authorization: `Bearer ${SUPABASE_SERVICE}` } }
      );
      const rows = await r.json();
      if (!r.ok) return res.status(500).json({ error: rows?.message || 'Could not read social_posts. Did you run supabase/social-analytics.sql?' });
      const byService = {};
      for (const p of rows) {
        const s = byService[p.service] ||= { service: p.service, posts: 0, views: 0, impressions: 0, reach: 0, reactions: 0, comments: 0, shares: 0, saves: 0, _er: 0, _erN: 0 };
        s.posts++;
        for (const k of ['views', 'impressions', 'reach', 'reactions', 'comments', 'shares', 'saves']) s[k] += Number(p[k]) || 0;
        if (p.engagement_rate != null) { s._er += Number(p.engagement_rate); s._erN++; }
      }
      const services = Object.values(byService).map(({ _er, _erN, ...s }) => ({ ...s, avg_engagement_rate: _erN ? +(_er / _erN).toFixed(2) : null }));
      // "views" is what video networks report; fall back to impressions where a network only has those.
      const score = (p) => Number(p.views ?? p.impressions) || 0;
      const top = [...rows].sort((a, b) => score(b) - score(a)).slice(0, 10)
        .map(p => ({ id: p.buffer_post_id, service: p.service, text: p.text, sent_at: p.sent_at, link: p.external_link, views: p.views, impressions: p.impressions, reactions: p.reactions, comments: p.comments }));
      const lastSync = rows.reduce((m, p) => (p.synced_at > m ? p.synced_at : m), '') || null;
      return res.status(200).json({ ok: true, days, total_posts: rows.length, services, top_posts: top, last_sync: lastSync });
    }

    if (!BUFFER_TOKEN) return res.status(500).json({ error: 'BUFFER_ACCESS_TOKEN not set in Vercel env vars' });

    // GET ?action=buffer&sub=channels — connected channels
    if (!sub || sub === 'channels') {
      const channels = await bufferChannels();
      return res.status(200).json({ ok: true, channels });
    }

    // POST ?action=buffer&sub=sync  Body/Query: { days? } — save sent posts + metrics to Supabase
    if (sub === 'sync') {
      const days = Math.min(Math.max(parseInt(req.query.days || req.body?.days, 10) || 90, 1), 365);
      return res.status(200).json({ ok: true, ...(await bufferSync(days)) });
    }

    // POST ?action=buffer&sub=publish-clip
    // Body: { video_url (https), caption, title?, channel_ids?, mode?, due_at?, draft?, dry_run?,
    //         thumbnail_offset_ms?, captions?: { instagram: '...', linkedin: '...' } }
    // Sends the same clip to every connected Instagram/Facebook/TikTok/YouTube/LinkedIn channel
    // (or just channel_ids), each with its own reel/short settings. One failure doesn't stop the rest.
    if (sub === 'publish-clip') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
      const b = req.body || {};
      if (!isHttpsUrl(b.video_url)) return res.status(400).json({ error: 'video_url must be a public https URL to an mp4' });
      if (!b.caption) return res.status(400).json({ error: 'caption required' });
      const mode = b.mode || 'addToQueue';
      if (!['addToQueue', 'customScheduled', 'shareNext'].includes(mode)) {
        return res.status(400).json({ error: 'mode must be addToQueue, customScheduled or shareNext' });
      }
      if (mode === 'customScheduled' && !(Date.parse(b.due_at) > Date.now())) {
        return res.status(400).json({ error: 'due_at (future ISO 8601) required for customScheduled' });
      }
      const all = await bufferChannels();
      let targets = all.filter(c => CLIP_SERVICES.includes(c.service) && !c.isDisconnected && !c.isLocked);
      if (Array.isArray(b.channel_ids) && b.channel_ids.length) targets = targets.filter(c => b.channel_ids.includes(c.id));
      if (!targets.length) return res.status(400).json({ error: 'No connected Instagram/Facebook/TikTok/YouTube/LinkedIn channels to post to' });

      const title = b.title || String(b.caption).split('\n')[0];
      const plans = targets.map(c => ({
        channel: c,
        input: {
          channelId: c.id,
          text: (b.captions && b.captions[c.service]) || b.caption,
          schedulingType: schedulingTypeFor(c),
          mode,
          ...(mode === 'customScheduled' ? { dueAt: new Date(b.due_at).toISOString() } : {}),
          ...(b.draft ? { saveToDraft: true } : {}),
          assets: [{ video: { url: b.video_url, ...(Number.isInteger(b.thumbnail_offset_ms) ? { metadata: { thumbnailOffset: b.thumbnail_offset_ms } } : {}) } }],
          metadata: clipMetadata(c.service, title),
        },
      }));
      if (b.dry_run) {
        return res.status(200).json({ ok: true, dry_run: true, plan: plans.map(p => ({ channel: `${p.channel.service}:${p.channel.name}`, input: p.input })) });
      }
      const results = await Promise.all(plans.map(async p => {
        try { return { channel: p.channel.name, service: p.channel.service, ...(await bufferCreatePost(p.input)) }; }
        catch (e) { return { channel: p.channel.name, service: p.channel.service, ok: false, error: e.message }; }
      }));
      return res.status(200).json({ ok: results.every(r => r.ok), results });
    }

    // POST ?action=buffer&sub=post — text/image post to chosen channels
    // Body: { text, channel_ids: [], scheduled_at?: ISO string, media_urls?: string[] }
    if (sub === 'post') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
      const { text, channel_ids, scheduled_at, media_urls } = req.body || {};
      if (!text || !channel_ids?.length) return res.status(400).json({ error: 'text and channel_ids required' });
      if (scheduled_at && !(Date.parse(scheduled_at) > Date.now())) return res.status(400).json({ error: 'scheduled_at must be a future ISO 8601 time' });
      if ((media_urls || []).some(u => !isHttpsUrl(u))) return res.status(400).json({ error: 'media_urls must be https URLs' });
      const byId = Object.fromEntries((await bufferChannels()).map(c => [c.id, c]));
      const results = await Promise.all(channel_ids.map(async id => {
        const c = byId[id];
        if (!c) return { channel: id, ok: false, error: 'Unknown channel' };
        try {
          return { channel: c.name, service: c.service, ...(await bufferCreatePost({
            channelId: id, text, schedulingType: schedulingTypeFor(c),
            mode: scheduled_at ? 'customScheduled' : 'addToQueue',
            ...(scheduled_at ? { dueAt: new Date(scheduled_at).toISOString() } : {}),
            ...(media_urls?.length ? { assets: media_urls.map(url => ({ image: { url } })) } : {}),
          })) };
        } catch (e) { return { channel: c.name, service: c.service, ok: false, error: e.message }; }
      }));
      return res.status(200).json({ ok: results.every(r => r.ok), results });
    }

    // GET ?action=buffer&sub=queue|sent[&channel_id=XXX] — scheduled or sent posts
    if (sub === 'queue' || sub === 'sent') {
      const { channel_id } = req.query;
      const d = await bufferGQL(
        `query($input: PostsInput!) {
           posts(first: 50, input: $input) {
             edges { node { id text status dueAt sentAt channelId channelService externalLink } }
           }
         }`,
        { input: { organizationId: BUFFER_ORG_ID, filter: { status: [sub === 'queue' ? 'scheduled' : 'sent'], ...(channel_id ? { channelIds: [channel_id] } : {}) } } }
      );
      return res.status(200).json({ ok: true, posts: (d?.posts?.edges || []).map(e => e.node) });
    }

    // POST ?action=buffer&sub=delete — delete a post. Body: { post_id }
    if (sub === 'delete') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
      const { post_id } = req.body || {};
      if (!post_id) return res.status(400).json({ error: 'post_id required' });
      const d = await bufferGQL(
        `mutation($input: DeletePostInput!) {
           deletePost(input: $input) { __typename ... on VoidMutationError { message } }
         }`,
        { input: { id: post_id } }
      );
      if (d?.deletePost?.message) return res.status(400).json({ error: d.deletePost.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown sub-action. Use: channels, publish-clip, post, queue, sent, delete, sync, analytics' });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
}

// ── SQUARE ──
async function handle_square(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Unlike every other action in this file (monthly-report, outreach, etc.)
  // this had no auth check at all — it proxies real Square payment/invoice
  // data (amounts, customer names, receipt info), so anyone who found the
  // URL could pull Sean's transaction history with a plain GET. Same guard
  // as the rest of this file.
  if (!(await isAdmin(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: 'Square not configured' });

  const { endpoint } = req.query;

  try {
    if (endpoint === 'locations') {
      const r = await fetch('https://connect.squareup.com/v2/locations', {
        headers: { Authorization: `Bearer ${token}`, 'Square-Version': '2024-01-18' }
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if (endpoint === 'payments') {
      const { begin_time, end_time, location_id } = req.query;
      const params = new URLSearchParams({ limit: '100' });
      if (begin_time)   params.set('begin_time', begin_time);
      if (end_time)     params.set('end_time', end_time);
      if (location_id)  params.set('location_id', location_id);

      // Square caps a page at 100 and hands back a cursor for the rest, which
      // was never followed, so the Payments tab stopped at the first page. A
      // failed page returns the error rather than a partial month.
      const payments = [];
      let cursor = null, pages = 0;
      do {
        if (cursor) params.set('cursor', cursor);
        const r = await fetch(`https://connect.squareup.com/v2/payments?${params}`, {
          headers: { Authorization: `Bearer ${token}`, 'Square-Version': '2024-01-18' }
        });
        const data = await r.json();
        if (!r.ok) return res.status(r.status).json(data);
        payments.push(...(data.payments || []));
        cursor = data.cursor || null;
      } while (cursor && ++pages < 50);
      return res.status(200).json({ payments });
    }

    if (endpoint === 'invoices') {
      const { location_id } = req.query;
      const params = new URLSearchParams({ limit: '200' });
      if (location_id) params.set('location_id', location_id);

      const r = await fetch(`https://connect.squareup.com/v2/invoices?${params}`, {
        headers: { Authorization: `Bearer ${token}`, 'Square-Version': '2024-01-18' }
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    return res.status(400).json({ error: 'Unknown endpoint' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;
  if (action === 'google-ads-auth') return handle_google_ads_auth(req, res);
  if (action === 'google-ads') return handle_google_ads(req, res);
  if (action === 'jobber') return handle_jobber(req, res);
  if (action === 'jobber-auth') return handle_jobber_auth(req, res);
  if (action === 'jobber-callback') return handle_jobber_callback(req, res);
  if (action === 'lsa-check') return handle_lsa_check(req, res);
  if (action === 'monthly-report') return handle_monthly_report(req, res);
  if (action === 'outreach') return handle_outreach_send(req, res);
  if (action === 'outreach-cron') return handle_outreach_cron(req, res);
  if (action === 'square') return handle_square(req, res);
  if (action === 'buffer') return handle_buffer(req, res);
  if (action === 'media') return handle_media(req, res);
  return res.status(400).json({ error: 'Unknown action' });
}

// ── Admin check ───────────────────────────────────────────────────────────────
// Real authentication: the caller must send a signed-in admin's Supabase session token
// (Authorization: Bearer ...). An admin is a user with a confirmed allow-listed email, or a
// row in public.users with role = 'admin'. The old shared "dashboard" header sat in the public
// page source, so it protected nothing. INTERNAL_API_KEY, if set in Vercel, still works for
// server-to-server calls, but there is no built-in default any more.
const ADMIN_EMAILS = String(process.env.ADMIN_EMAILS || process.env.STATS_ALLOWED_EMAILS || 'seanjevangelista@gmail.com,seanjayme@evanenterprise.com').toLowerCase().split(',').map((e) => e.trim()).filter(Boolean);
async function isAdmin(req) {
  const url = process.env.SUPABASE_URL || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
  const svc = process.env.SUPABASE_SERVICE_KEY;
  const secret = process.env.INTERNAL_API_KEY;
  if (secret && req.headers['x-internal-key'] === secret) return true;
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token || !svc) return false;
  try {
    const w = await fetch(`${url}/auth/v1/user`, { headers: { apikey: svc, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(4000) });
    if (!w.ok) return false;
    const u = await w.json();
    if (!u || !u.id) return false;
    if (u.email_confirmed_at && ADMIN_EMAILS.includes(String(u.email || '').toLowerCase())) return true;
    const r = await fetch(`${url}/rest/v1/users?id=eq.${encodeURIComponent(u.id)}&select=role&limit=1`, { headers: { apikey: svc, Authorization: `Bearer ${svc}` }, signal: AbortSignal.timeout(4000) });
    const rows = await r.json();
    return Array.isArray(rows) && !!rows[0] && rows[0].role === 'admin';
  } catch (e) { return false; }
}
