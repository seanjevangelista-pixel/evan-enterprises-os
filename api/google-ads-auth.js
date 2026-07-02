const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON || 'sb_publishable_C6qf6KSBHv07VGTDNmpvZg_H0nnLrhR';
const REDIRECT_URI  = 'https://evan-enterprises-os.vercel.app/dashboard';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, code } = req.query;

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
