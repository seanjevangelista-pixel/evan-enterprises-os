// api/admin.js — Admin operations (create client, create portal login, list clients)
// Protected: requires service key. Called only from /admin page by Sean.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
  const RESEND_KEY   = process.env.RESEND_API_KEY;

  const sb = {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }
  };

  const action = req.query.action || req.body?.action;

  // ── LIST CLIENTS ───────────────────────────────────────────────────────────
  if (action === 'list_clients') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/clients?select=*&order=created_at.desc`, { headers: sb.headers });
    const clients = await r.json();
    return res.status(200).json({ ok: true, clients });
  }

  if (action === 'list_leads') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/lsa_leads?select=*,clients(business_name)&order=lead_date.desc,created_at.desc&limit=200`, { headers: sb.headers });
    const leads = await r.json();
    return res.status(200).json({ ok: true, leads });
  }

  if (action === 'list_invoices') {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/invoices?select=*,clients(business_name)&order=created_at.desc&limit=200`, { headers: sb.headers });
    const invoices = await r.json();
    return res.status(200).json({ ok: true, invoices });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};

  // ── CREATE CLIENT ──────────────────────────────────────────────────────────
  if (action === 'create_client') {
    const {
      business_name, contact_name, contact_email, contact_phone,
      monthly_fee, notes,
      has_google_ads, has_lsa, has_facebook, has_instagram,
      has_reporting, has_jobber, has_seo, has_social,
    } = body;

    if (!business_name) return res.status(400).json({ error: 'business_name required' });

    const row = {
      business_name, contact_name, contact_email, contact_phone,
      monthly_fee: monthly_fee || null, notes,
      has_google_ads: !!has_google_ads, has_lsa: !!has_lsa,
      has_facebook: !!has_facebook, has_instagram: !!has_instagram,
      has_reporting: has_reporting !== false,
      has_jobber: !!has_jobber, has_seo: !!has_seo, has_social: !!has_social,
    };

    const r = await fetch(`${SUPABASE_URL}/rest/v1/clients`, {
      method: 'POST', headers: sb.headers, body: JSON.stringify(row),
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data?.message || 'Failed to create client' });

    return res.status(200).json({ ok: true, client: Array.isArray(data) ? data[0] : data });
  }

  // ── CREATE PORTAL LOGIN ────────────────────────────────────────────────────
  if (action === 'create_portal_login') {
    const { client_id, email, send_welcome } = body;
    if (!client_id || !email) return res.status(400).json({ error: 'client_id and email required' });

    // Generate a temp password
    const tempPw = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase() + '!';

    // Create Supabase Auth user via admin API
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password: tempPw, email_confirm: true }),
    });
    const authData = await authRes.json();
    if (!authRes.ok) return res.status(500).json({ error: authData?.msg || authData?.message || 'Failed to create auth user' });

    const userId = authData.id;

    // Link to client in public.users
    const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: sb.headers,
      body: JSON.stringify({ id: userId, client_id, email, role: 'client' }),
    });
    if (!userRes.ok) {
      const err = await userRes.json();
      return res.status(500).json({ error: err?.message || 'Failed to link user to client' });
    }

    // Fetch client name for welcome email
    let clientName = 'your business';
    try {
      const cr = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${client_id}&select=business_name&limit=1`, { headers: sb.headers });
      const cd = await cr.json();
      if (cd?.[0]?.business_name) clientName = cd[0].business_name;
    } catch (_) {}

    // Send welcome email
    if (send_welcome && RESEND_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'EVAN Enterprises <noreply@evanenterprise.com>',
          to: [email],
          reply_to: 'seanjevangelista@gmail.com',
          subject: `Your client portal is ready — ${clientName}`,
          html: welcomeEmail({ clientName, email, tempPw }),
        }),
      });
    }

    return res.status(200).json({ ok: true, user_id: userId, temp_password: tempPw });
  }

  // ── UPDATE CLIENT SERVICES ─────────────────────────────────────────────────
  if (action === 'update_client') {
    const { id, ...fields } = body;
    if (!id) return res.status(400).json({ error: 'id required' });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${id}`, {
      method: 'PATCH', headers: sb.headers, body: JSON.stringify(fields),
    });
    if (!r.ok) return res.status(500).json({ error: 'Update failed' });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}

function welcomeEmail({ clientName, email, tempPw }) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:Inter,sans-serif;background:#F8FAFC;padding:32px;color:#0F172A">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #E2E8F0;overflow:hidden">
    <div style="background:#0F172A;padding:20px 28px">
      <div style="color:#fff;font-weight:700;font-size:16px">EVAN Enterprises</div>
      <div style="color:#94A3B8;font-size:12px;margin-top:2px">Client Portal Access</div>
    </div>
    <div style="padding:28px">
      <h2 style="margin:0 0 8px;font-size:18px">Your portal is ready.</h2>
      <p style="color:#64748B;font-size:13px;margin:0 0 24px;line-height:1.6">
        Your client dashboard for <strong>${clientName}</strong> is live.
        You can view your leads, invoices, and campaign performance anytime.
      </p>
      <div style="background:#F8FAFC;border-radius:8px;padding:18px;margin-bottom:24px;border:1px solid #E2E8F0">
        <div style="font-size:11px;color:#94A3B8;letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px">Your login</div>
        <div style="font-size:13px;margin-bottom:6px"><span style="color:#64748B">Email:</span> <strong>${email}</strong></div>
        <div style="font-size:13px"><span style="color:#64748B">Password:</span> <strong style="font-family:monospace;background:#EFF6FF;padding:2px 6px;border-radius:4px">${tempPw}</strong></div>
      </div>
      <a href="https://evan-enterprises-os.vercel.app/portal"
         style="display:inline-block;background:#3B82F6;color:#fff;padding:11px 22px;border-radius:7px;text-decoration:none;font-size:13px;font-weight:600">
        Sign in to your portal →
      </a>
      <p style="margin-top:20px;font-size:11px;color:#94A3B8;line-height:1.6">
        Change your password after first login. Reply to this email if you need help.
      </p>
    </div>
  </div>
</body>
</html>`;
}
