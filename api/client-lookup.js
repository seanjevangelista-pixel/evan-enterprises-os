// api/client-lookup.js
// Looks up a client ID by website domain — used by client sites to auto-identify themselves
// GET ?domain=premierlandscapingatx.com
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  const { domain }  = req.query;

  if (!domain) return res.status(400).json({ error: 'domain required' });

  try {
    const r    = await fetch(`${supabaseUrl}/rest/v1/clients?website_domain=eq.${encodeURIComponent(domain)}&select=id,business_name,owner_email,owner_name`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    });
    const data = await r.json();
    const client = Array.isArray(data) ? data[0] : null;

    if (!client) return res.status(404).json({ error: 'Client not found for domain' });
    return res.status(200).json({ ok: true, client });
  } catch (e) {
    return res.status(502).json({ error: 'Lookup failed: ' + e.message });
  }
}
