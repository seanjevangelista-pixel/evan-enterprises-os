// api/client-lookup.js
// Looks up a client ID by website domain — used by client sites to auto-identify themselves
// GET ?domain=premierlandscapingatx.com
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({ error: 'Method not allowed' });

  if (req.query.action === 'go') return handleGo(req, res);

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

// GET /go/:slug?s=<source> (rewritten here by vercel.json) — tracked short links.
// Destinations come only from data/links.json (fetched from our own origin), never
// from the query string, so this cannot be used as an open redirect. Click logging
// is best-effort: a Supabase failure never blocks the redirect.
async function handleGo(req, res) {
  const slug = String(req.query.slug || '').toLowerCase();
  const fallback = '/links';
  res.setHeader('Cache-Control', 'no-store');

  if (!/^[a-z0-9-]{1,40}$/.test(slug)) return res.redirect(302, fallback);

  const proto = req.headers['x-forwarded-proto'] || 'https';
  let dest = '';
  try {
    const r = await fetch(`${proto}://${req.headers.host}/data/links.json`, { signal: AbortSignal.timeout(2500) });
    const link = ((await r.json()).links || []).find((l) => l.slug === slug);
    dest = link && link.url ? link.url : '';
  } catch (e) {
    console.error('go: could not read links.json:', e.message);
  }

  const safe = dest.startsWith('https://') || (dest.startsWith('/') && !dest.startsWith('//'));
  if (!safe) return res.redirect(302, fallback);

  const ua = String(req.headers['user-agent'] || '');
  const isBot = req.method === 'HEAD' || /bot|crawl|spider|preview|facebookexternalhit|slurp/i.test(ua);
  if (!isBot) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    let referrer = '';
    try { referrer = req.headers.referer ? new URL(req.headers.referer).hostname : ''; } catch (e) { /* ignore bad referer */ }
    try {
      const w = await fetch(`${supabaseUrl}/rest/v1/link_clicks`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          slug,
          source: String(req.query.s || '').slice(0, 40) || null,
          referrer: referrer.slice(0, 80) || null,
          country: String(req.headers['x-vercel-ip-country'] || '').slice(0, 2) || null,
        }),
        signal: AbortSignal.timeout(1200),
      });
      if (!w.ok) console.error('go: click not logged, Supabase said', w.status);
    } catch (e) {
      console.error('go: click not logged:', e.message);
    }
  }
  return res.redirect(302, dest);
}
