import { timingSafeEqual } from 'node:crypto';
// api/client-lookup.js
// Looks up a client ID by website domain — used by client sites to auto-identify themselves
// GET ?domain=premierlandscapingatx.com
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).json({ error: 'Method not allowed' });

  if (req.query.action === 'go') return handleGo(req, res);
  if (req.query.action === 'hit') return handleHit(req, res);
  if (req.query.action === 'stats') return handleStats(req, res);

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
    // The links page passes the visitor's original source (instagram, tiktok ...) as r=
    referrer = normSrc(req.query.r) || referrer;
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

// ── Site analytics ─────────────────────────────────────────────────────────────
// GET /api/client-lookup?action=hit&t=pv|click&k=<label>&p=<path>&r=<referrer host>&s=<source>
// Called by js/site.js on every page view and tracked click. Rows go into link_clicks with a
// namespaced slug: "pv:/path" for page views, "click:<label>" for site button/link clicks
// (plain slugs are /go/ tracked links). No cookies, no IP address, no personal data stored.

// Maps a referrer host or utm source to a short channel name (instagram, tiktok, linkedin ...).
const SRC_RULES = [[/instagram|^ig$|^l\.instagram/, 'instagram'], [/tiktok/, 'tiktok'], [/linkedin|lnkd\.in/, 'linkedin'], [/youtube|youtu\.be/, 'youtube'], [/facebook|^fb\.|^m\.facebook|^l\.facebook/, 'facebook'], [/discord/, 'discord'], [/^t\.co$|twitter|^x\.com$/, 'x'], [/google/, 'google'], [/bing|duckduckgo|yahoo|ecosia/, 'search'], [/evanenterprise/, 'direct']];
function normSrc(v) {
  v = String(v || '').toLowerCase().replace(/^www\./, '').trim();
  if (!v) return '';
  for (const [re, name] of SRC_RULES) if (re.test(v)) return name;
  return v.slice(0, 30);
}
const SITE_HOSTS = /^(www\.)?evanenterprise\.com$/i; // only the real site counts
function cleanHost(v) { v = String(v || '').toLowerCase().slice(0, 80); return /^[a-z0-9.-]+$/.test(v) ? v : ''; }

async function handleHit(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    // Only accept beacons that come from our own pages (cuts casual spam from other sites).
    let from = '';
    try { from = new URL(req.headers.origin || req.headers.referer || '').hostname; } catch (e) { /* none */ }
    if (!SITE_HOSTS.test(from)) return res.status(204).end();
    const agent = String(req.headers['user-agent'] || '');
    if (/bot|crawl|spider|preview|facebookexternalhit|slurp|headless/i.test(agent)) return res.status(204).end();

    const t = String(req.query.t || '');
    const path = String(req.query.p || '');
    const label = String(req.query.k || '');
    if (t !== 'pv' && t !== 'click') return res.status(204).end();
    if (!/^\/[A-Za-z0-9/_.-]{0,60}$/.test(path) || path.includes('..')) return res.status(204).end();
    if (t === 'click' && !/^[A-Za-z0-9:/._@+-]{1,60}$/.test(label)) return res.status(204).end();

    const supabaseUrl = process.env.SUPABASE_URL || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
    const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    const src = String(req.query.s || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
    await fetch(`${supabaseUrl}/rest/v1/link_clicks`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        slug: t === 'pv' ? `${req.query.e === '1' ? 'visit' : 'pv'}:${path}` : `click:${label}`,
        source: t === 'pv' ? (src || null) : path,
        referrer: normSrc(cleanHost(req.query.r)) || null,
        country: String(req.headers['x-vercel-ip-country'] || '').slice(0, 2) || null,
      }),
      signal: AbortSignal.timeout(1500),
    }).then((w) => { if (!w.ok) console.error('hit: not logged, Supabase said', w.status); });
  } catch (e) {
    console.error('hit: not logged:', e.message);
  }
  return res.status(204).end();
}

// GET /api/client-lookup?action=stats&days=30 — private: needs Sean's signed-in Supabase session.

async function handleStats(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const supabaseUrl = process.env.SUPABASE_URL || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'Server is missing SUPABASE_SERVICE_KEY' });

  // Read-only access for the scheduled daily snapshot: a long random key in ANALYTICS_FEED_KEY (Vercel).
  // It only unlocks this stats read, nothing else. Unset or short keys disable it.
  const feedKey = String(process.env.ANALYTICS_FEED_KEY || '');
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  let feedOk = false;
  if (feedKey.length >= 32 && bearer.length === feedKey.length) {
    try { feedOk = timingSafeEqual(Buffer.from(bearer), Buffer.from(feedKey)); } catch (e) { feedOk = false; }
  }
  if (!feedOk && !(await isAdmin(req))) return res.status(401).json({ error: 'Sign in to the dashboard first' });

  const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
  const since = new Date(Date.now() - days * 864e5).toISOString();
  let rows;
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/link_clicks?clicked_at=gte.${encodeURIComponent(since)}&select=slug,source,referrer,country,clicked_at&order=clicked_at.desc&limit=50000`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(8000) });
    rows = await r.json();
    if (!Array.isArray(rows)) return res.status(502).json({ error: 'Could not read analytics (is the link_clicks table created?)' });
  } catch (e) {
    return res.status(502).json({ error: 'Could not read analytics: ' + e.message });
  }

  const tally = (map, k) => { if (k) map[k] = (map[k] || 0) + 1; };
  const top = (map, n = 12) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
  const pages = {}, links = {}, buttons = {}, referrers = {}, countries = {}, byDay = {}, bySource = {}, dest = {};
  const totals = { pageViews: 0, visits: 0, linkClicks: 0, siteClicks: 0, contacts: 0 };
  const CONTACT_CLICKS = ['email', 'call', 'text', 'ig-dm', 'form:contact'];
  const CONTACT_GO = ['discord'];
  const SOCIAL_GO = ['tiktok', 'instagram', 'youtube', 'linkedin', 'discord'];
  const mix = {}, methods = {};
  const addContact = (src, method) => { mix[src] = mix[src] || {}; mix[src][method] = (mix[src][method] || 0) + 1; methods[method] = (methods[method] || 0) + 1; };
  const bump = (src, key) => { bySource[src] = bySource[src] || { visitors: 0, clicks: 0, contacts: 0 }; bySource[src][key]++; };
  for (const row of rows) {
    const day = String(row.clicked_at).slice(0, 10);
    byDay[day] = byDay[day] || { pageViews: 0, linkClicks: 0, siteClicks: 0 };
    if (row.slug.startsWith('pv:') || row.slug.startsWith('visit:')) {
      const isVisit = row.slug.startsWith('visit:');
      const src = normSrc(row.referrer) || normSrc(row.source) || 'direct';
      totals.pageViews++; byDay[day].pageViews++; tally(pages, row.slug.slice(row.slug.indexOf(':') + 1)); tally(referrers, src);
      if (isVisit) { totals.visits++; bump(src, 'visitors'); }
    } else if (row.slug.startsWith('click:')) {
      const label = row.slug.slice(6), src = normSrc(row.referrer) || 'direct';
      totals.siteClicks++; byDay[day].siteClicks++; tally(buttons, label);
      bump(src, 'clicks');
      if (CONTACT_CLICKS.includes(label)) { totals.contacts++; bump(src, 'contacts'); addContact(src, label); }
      if (label.startsWith('out:')) tally(dest, normSrc(label.slice(4).split('/')[0]));
    } else {
      const src = normSrc(row.referrer) || 'direct';
      totals.linkClicks++; byDay[day].linkClicks++; tally(links, row.slug);
      bump(src, 'clicks');
      if (CONTACT_GO.includes(row.slug)) { totals.contacts++; bump(src, 'contacts'); addContact(src, row.slug); }
      if (SOCIAL_GO.includes(row.slug)) tally(dest, row.slug);
    }
    tally(countries, row.country);
  }
  const funnel = {
    stages: [
      { name: 'Visits', count: totals.visits },
      { name: 'Clicked something', count: totals.linkClicks + totals.siteClicks },
      { name: 'Reached out', count: totals.contacts },
    ],
    bySource: Object.entries(bySource).map(([source, v]) => ({ source, ...v })).sort((a, b) => b.visitors - a.visitors || b.clicks - a.clicks).slice(0, 12),
    destinations: top(dest, 8),
    contactMethods: top(methods, 8),
    contactMix: Object.entries(mix).map(([source, m]) => ({ source, total: Object.values(m).reduce((a, b) => a + b, 0), methods: m })).sort((a, b) => b.total - a.total).slice(0, 12),
  };
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    series.push({ day: d, ...(byDay[d] || { pageViews: 0, linkClicks: 0, siteClicks: 0 }) });
  }
  return res.status(200).json({ ok: true, v: 1, at: new Date().toISOString(), days, totals, funnel, pages: top(pages), links: top(links), buttons: top(buttons, 15), referrers: top(referrers), countries: top(countries, 8), series });
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
