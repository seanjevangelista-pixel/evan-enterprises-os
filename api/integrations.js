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
//   status text default 'pending', -- pending, sent, replied, converted, unsubscribed
//   notes text,
//   last_emailed_at timestamptz,
//   follow_up_count int default 0,
//   created_at timestamptz default now()
// );
// -----------------------------------------------------------------------------


function buildInitialEmail({ businessName, ownerName, city, niche, painPoint }) {
  const firstName = ownerName ? ownerName.split(' ')[0] : 'there';
  const nicheLabel = niche || 'local service';
  const cityLabel  = city  || 'your area';
  const pain       = painPoint || 'missing out on leads because their digital presence isn\'t keeping up';

  const subject = `Quick question about ${businessName}'s online presence`;

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
      <div style="color:#94A3B8;font-size:11px;margin-top:2px">Business Growth & Digital Operations</div>
    </div>
  </div>

  <div style="background:#fff;padding:28px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px">
    <p style="font-size:14px;color:#0F172A;line-height:1.7;margin:0 0 16px">Hey ${firstName},</p>

    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px">
      I came across <strong>${businessName}</strong> while looking at ${nicheLabel} businesses in ${cityLabel} — wanted to reach out directly.
    </p>

    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px">
      Most ${nicheLabel} businesses in ${cityLabel} are losing leads right now because ${pain}. It's not a business problem — it's a visibility and systems problem, and it's fixable fast.
    </p>

    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px">
      At Evan Enterprises, we handle the entire digital side for local businesses — website, Google Ads, lead intake, invoicing, monthly reporting. You run the jobs, we run everything else.
    </p>

    <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:8px;padding:16px 20px;margin:20px 0">
      <div style="font-size:12px;font-weight:700;color:#0369A1;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">What We Do For Clients</div>
      <p style="font-size:13px;color:#0F172A;line-height:1.6;margin:0">
        We currently manage <strong>Premier Landscaping ATX</strong> — handling their entire operation: Google Ads, LSA, website, invoicing via Jobber, and monthly performance reports. They focus on the work; we handle the rest.
      </p>
    </div>

    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 20px">
      Would it make sense to jump on a quick 15-min call this week? No pitch deck, no pressure — just want to see if there's a fit.
    </p>

    <div style="border-top:1px solid #E2E8F0;padding-top:20px;display:flex;align-items:center;gap:14px">
      <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#3B82F6);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px;flex-shrink:0">SE</div>
      <div>
        <div style="font-size:13px;font-weight:600;color:#0F172A">Sean Evangelista</div>
        <div style="font-size:12px;color:#64748B">Evan Enterprises LLC</div>
        <div style="font-size:12px;color:#64748B">sean@evanenterprise.com</div>
      </div>
    </div>
  </div>

</div>
</body></html>`;

  return { subject, html };
}

function buildFollowUpEmail({ businessName, ownerName, city }) {
  const firstName = ownerName ? ownerName.split(' ')[0] : 'there';
  const cityLabel  = city || 'your area';

  const subject = `Re: Quick question about ${businessName}'s online presence`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#F1F5F9;font-family:Inter,-apple-system,Arial,sans-serif">
<div style="max-width:540px;margin:0 auto">
  <div style="background:#fff;padding:28px;border:1px solid #E2E8F0;border-radius:12px">
    <p style="font-size:14px;color:#0F172A;line-height:1.7;margin:0 0 14px">Hey ${firstName},</p>
    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 14px">
      Just wanted to follow up on my last email — I know inboxes get busy.
    </p>
    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 14px">
      Happy to show you exactly what we do for a similar business in ${cityLabel} — real numbers, real results. Worth a quick call?
    </p>
    <div style="border-top:1px solid #E2E8F0;padding-top:18px;display:flex;align-items:center;gap:12px">
      <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#3B82F6);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:13px;flex-shrink:0">SE</div>
      <div>
        <div style="font-size:13px;font-weight:600;color:#0F172A">Sean — Evan Enterprises LLC</div>
        <div style="font-size:12px;color:#64748B">sean@evanenterprise.com</div>
      </div>
    </div>
  </div>
</div>
</body></html>`;

  return { subject, html };
}

async function handle_outreach_send(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { leads = [], followUp = false } = req.body || {};
  if (!leads.length) return res.status(400).json({ error: 'No leads provided' });

  const resendKey   = process.env.RESEND_API_KEY;
  const supabaseUrl = 'https://hzcgdnhecgewqpcnumwm.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY not set' });

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

    const emailOk = !emailResult.error;
    if (emailOk) sent++;

    // Upsert lead in Supabase
    if (supabaseKey) {
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

  return res.status(200).json({ ok: true, sent, results });
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
const BUFFER_TOKEN = process.env.BUFFER_ACCESS_TOKEN;
const BUFFER_ORG_ID = '6a52f6662ab024a3a8c01a78';

async function bufferGQL(query, variables = {}) {
  const r = await fetch('https://api.buffer.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BUFFER_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  return r.json();
}

async function handle_buffer(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!BUFFER_TOKEN) return res.status(500).json({ error: 'BUFFER_ACCESS_TOKEN not set in Vercel env vars' });

  const { sub } = req.query;

  // GET ?action=buffer&sub=channels — list all connected channels
  if (!sub || sub === 'channels') {
    try {
      const data = await bufferGQL(`{ channels(input: { organizationId: "${BUFFER_ORG_ID}" }) { id service name serviceId } }`);
      if (data.errors) return res.status(400).json({ error: data.errors[0]?.message });
      return res.status(200).json({ ok: true, channels: data.data?.channels || [] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST ?action=buffer&sub=post — create/schedule a post
  // Body: { text, channel_ids: [], scheduled_at?: ISO string, media_urls?: string[] }
  if (sub === 'post') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
    const { text, channel_ids, scheduled_at, media_urls } = req.body || {};
    if (!text || !channel_ids?.length) return res.status(400).json({ error: 'text and channel_ids required' });

    try {
      const media = media_urls?.length
        ? media_urls.map(url => `{ url: "${url}", mediaType: IMAGE }`)
        : [];
      const scheduledAtArg = scheduled_at ? `, scheduledAt: "${scheduled_at}"` : '';
      const mediaArg = media.length ? `, media: [${media.join(', ')}]` : '';
      const channelIds = channel_ids.map(id => `"${id}"`).join(', ');

      const mutation = `
        mutation {
          createPost(input: {
            organizationId: "${BUFFER_ORG_ID}",
            channelIds: [${channelIds}],
            text: ${JSON.stringify(text)}
            ${scheduledAtArg}
            ${mediaArg}
          }) {
            posts { id status scheduledAt channel { service name } }
          }
        }
      `;
      const data = await bufferGQL(mutation);
      if (data.errors) return res.status(400).json({ error: data.errors[0]?.message });
      return res.status(200).json({ ok: true, posts: data.data?.createPost?.posts || [] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // GET ?action=buffer&sub=queue&channel_id=XXX — scheduled queue for a channel
  if (sub === 'queue') {
    const { channel_id } = req.query;
    if (!channel_id) return res.status(400).json({ error: 'channel_id required' });
    try {
      const data = await bufferGQL(`{
        posts(input: { organizationId: "${BUFFER_ORG_ID}", channelIds: ["${channel_id}"], status: [SCHEDULED] }) {
          edges { node { id text status scheduledAt channel { service name } } }
        }
      }`);
      if (data.errors) return res.status(400).json({ error: data.errors[0]?.message });
      const posts = (data.data?.posts?.edges || []).map(e => e.node);
      return res.status(200).json({ ok: true, posts });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // GET ?action=buffer&sub=sent&channel_id=XXX — sent posts for a channel
  if (sub === 'sent') {
    const { channel_id } = req.query;
    if (!channel_id) return res.status(400).json({ error: 'channel_id required' });
    try {
      const data = await bufferGQL(`{
        posts(input: { organizationId: "${BUFFER_ORG_ID}", channelIds: ["${channel_id}"], status: [SENT] }) {
          edges { node { id text status scheduledAt channel { service name } } }
        }
      }`);
      if (data.errors) return res.status(400).json({ error: data.errors[0]?.message });
      const posts = (data.data?.posts?.edges || []).map(e => e.node);
      return res.status(200).json({ ok: true, posts });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST ?action=buffer&sub=delete — delete a scheduled post
  // Body: { post_id }
  if (sub === 'delete') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
    const { post_id } = req.body || {};
    if (!post_id) return res.status(400).json({ error: 'post_id required' });
    try {
      const data = await bufferGQL(`
        mutation { deletePost(input: { postId: "${post_id}" }) { postId } }
      `);
      if (data.errors) return res.status(400).json({ error: data.errors[0]?.message });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'Unknown sub-action. Use: channels, post, queue, sent, delete' });
}

// ── SQUARE ──
async function handle_square(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

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
      const params = new URLSearchParams({ limit: '200' });
      if (begin_time)   params.set('begin_time', begin_time);
      if (end_time)     params.set('end_time', end_time);
      if (location_id)  params.set('location_id', location_id);

      const r = await fetch(`https://connect.squareup.com/v2/payments?${params}`, {
        headers: { Authorization: `Bearer ${token}`, 'Square-Version': '2024-01-18' }
      });
      const data = await r.json();
      return res.status(r.status).json(data);
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
  if (action === 'square') return handle_square(req, res);
  if (action === 'buffer') return handle_buffer(req, res);
  if (action === 'media') return handle_media(req, res);
  return res.status(400).json({ error: 'Unknown action' });
}
