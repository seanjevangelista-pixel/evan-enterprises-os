// api/portal.js — Authenticated portal data endpoint
// Client passes their Supabase access_token; we validate it, find their client_id,
// and return all their data using the service role key (bypasses RLS).

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

  const sb = {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    }
  };

  // Validate caller's JWT to get their user id
  const authHeader = req.headers.authorization || '';
  const userToken  = authHeader.replace('Bearer ', '').trim();
  if (!userToken) return res.status(401).json({ error: 'Missing token' });

  // Verify token via Supabase Auth
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${userToken}` },
  });
  if (!authRes.ok) return res.status(401).json({ error: 'Invalid token' });
  const authUser = await authRes.json();
  const userId = authUser.id;

  // Look up client_id from users table
  const userRow = await fetch(
    `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=client_id&limit=1`,
    { headers: sb.headers }
  ).then(r => r.json());

  const clientId = userRow?.[0]?.client_id;
  if (!clientId) return res.status(403).json({ error: 'No client linked to this account' });

  // Fetch all client data in parallel
  const now         = new Date();
  const day30Ago    = new Date(now - 30 * 86400e3).toISOString().split('T')[0];
  const moStart     = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMoStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMoEnd   = moStart;

  const [client, lsaAll, lsaLastMo, callsThisMo, callsLastMo, invoices] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${clientId}&select=*&limit=1`, { headers: sb.headers }).then(r => r.json()).then(d => d[0] || null).catch(() => null),
    fetch(`${SUPABASE_URL}/rest/v1/lsa_leads?client_id=eq.${clientId}&lead_date=gte.${day30Ago}&order=lead_date.desc`, { headers: sb.headers }).then(r => r.json()).catch(() => []),
    fetch(`${SUPABASE_URL}/rest/v1/lsa_leads?client_id=eq.${clientId}&lead_date=gte.${lastMoStart}&lead_date=lt.${lastMoEnd}&select=id`, { headers: sb.headers }).then(r => r.json()).catch(() => []),
    fetch(`${SUPABASE_URL}/rest/v1/call_leads?client_id=eq.${clientId}&tapped_at=gte.${moStart}`, { headers: sb.headers }).then(r => r.json()).catch(() => []),
    fetch(`${SUPABASE_URL}/rest/v1/call_leads?client_id=eq.${clientId}&tapped_at=gte.${lastMoStart}&tapped_at=lt.${lastMoEnd}&select=id`, { headers: sb.headers }).then(r => r.json()).catch(() => []),
    fetch(`${SUPABASE_URL}/rest/v1/invoices?client_id=eq.${clientId}&order=due_date.desc&limit=10`, { headers: sb.headers }).then(r => r.json()).catch(() => []),
  ]);

  return res.status(200).json({ ok: true, client, lsaAll, lsaLastMo, callsThisMo, callsLastMo, invoices });
}
