export default async function handler(req, res) {
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
        `${sbUrl}/rest/v1/settings?key=in.(gads_dev_token,gads_client_id,gads_client_secret,gads_refresh_token,gads_mcc_id)&select=key,value`,
        { headers: { apikey: sbAnon, Authorization: `Bearer ${sbAnon}` } }
      );
      const rows = await r.json();
      if (Array.isArray(rows)) {
        const map = {};
        rows.forEach(row => { map[row.key] = row.value; });
        devToken     = devToken     || map['gads_dev_token']      || '';
        clientId     = clientId     || map['gads_client_id']      || '';
        clientSec    = clientSec    || map['gads_client_secret']  || '';
        refreshToken = refreshToken || map['gads_refresh_token']  || '';
        mccId        = mccId        || map['gads_mcc_id']         || '';
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
