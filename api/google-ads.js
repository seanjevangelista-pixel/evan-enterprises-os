export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const devToken    = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId    = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSec   = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken= process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const customerId  = process.env.GOOGLE_ADS_CUSTOMER_ID; // no dashes, e.g. 8314281049

  if (!devToken || !clientId || !clientSec || !refreshToken || !customerId) {
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
    if (tokenErr) return res.status(401).json({ error: 'OAuth failed: ' + tokenErr });

    const headers = {
      Authorization:             `Bearer ${access_token}`,
      'developer-token':         devToken,
      'Content-Type':            'application/json',
    };

    const { metric } = req.query; // campaigns | keywords | overview

    // ── Campaign performance (last 30 days) ─────────────────────────────────
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
      return res.status(r.status).json({ configured: true, ...data });
    }

    // ── Overview summary ────────────────────────────────────────────────────
    if (metric === 'overview') {
      const query = `
        SELECT
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.all_conversions,
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
      return res.status(r.status).json({ configured: true, ...data });
    }

    return res.status(400).json({ error: 'Unknown metric' });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
