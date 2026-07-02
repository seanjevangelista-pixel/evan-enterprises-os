export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const clientId     = process.env.JOBBER_CLIENT_ID;
  const clientSecret = process.env.JOBBER_CLIENT_SECRET;
  const refreshToken = process.env.JOBBER_REFRESH_TOKEN;

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
