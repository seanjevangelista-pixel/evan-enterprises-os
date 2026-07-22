// api/distribution.js — Distribution leads & subscriber management
// Actions: leads, add-lead, update-lead, delete-lead,
//          subscribers, add-subscriber, update-subscriber, send-blast

const SB_URL = process.env.SUPABASE_URL || 'https://hzcgdnhecgewqpcnumwm.supabase.co';

function sbHeaders(key) {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action    = req.query.action;
  const sbKey     = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const h         = sbHeaders(sbKey);

  // ── GET LEADS (public — gated by access_token on portal side) ────────────
  if (action === 'leads') {
    const r = await fetch(`${SB_URL}/rest/v1/distribution_leads?status=eq.active&order=created_at.desc`, { headers: h });
    const leads = await r.json();
    return res.status(200).json({ ok: true, leads: Array.isArray(leads) ? leads : [] });
  }

  // ── FETCH AMAZON PRODUCT ─────────────────────────────────────────────────
  if (action === 'fetch-amazon' && req.method === 'POST') {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url required' });

    const asinMatch = url.match(/\/([A-Z0-9]{10})(?:[/?]|$)/);
    const asin = asinMatch ? asinMatch[1] : null;

    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });
      const html = await r.text();

      const titleMatch = html.match(/<span id="productTitle"[^>]*>\s*([\s\S]*?)\s*<\/span>/);
      const title = titleMatch ? titleMatch[1].trim() : null;

      const priceMatch = html.match(/class="a-price-whole">([0-9,]+)/) || html.match(/"priceAmount":"?([0-9.]+)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : null;

      const imgMatch = html.match(/"hiRes":"(https:[^"]+)"/) || html.match(/id="landingImage"[^>]*src="([^"]+)"/);
      const image_url = imgMatch ? imgMatch[1] : null;

      return res.status(200).json({ ok: true, asin, title, price, image_url });
    } catch (e) {
      return res.status(200).json({ ok: false, error: e.message });
    }
  }

  // ── ADD LEAD ──────────────────────────────────────────────────────────────
  if (action === 'add-lead' && req.method === 'POST') {
    const { title, description, platform, category, image_url, buy_price, sell_price, monthly_sales, competition } = req.body || {};
    if (!title || !buy_price || !sell_price) return res.status(400).json({ error: 'title, buy_price, sell_price required' });
    const r = await fetch(`${SB_URL}/rest/v1/distribution_leads`, {
      method: 'POST',
      headers: { ...h, Prefer: 'return=representation' },
      body: JSON.stringify({ title, description, platform, category, image_url, buy_price, sell_price, monthly_sales, competition }),
    });
    const data = await r.json();
    if (!r.ok || !Array.isArray(data) || !data[0]) {
      return res.status(502).json({ ok: false, error: (data && data.message) || 'Insert failed' });
    }
    return res.status(200).json({ ok: true, lead: data[0] });
  }

  // ── UPDATE LEAD ───────────────────────────────────────────────────────────
  if (action === 'update-lead' && req.method === 'POST') {
    const { id, ...fields } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    await fetch(`${SB_URL}/rest/v1/distribution_leads?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...h, Prefer: 'return=minimal' },
      body: JSON.stringify(fields),
    });
    return res.status(200).json({ ok: true });
  }

  // ── DELETE LEAD ───────────────────────────────────────────────────────────
  if (action === 'delete-lead' && req.method === 'POST') {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    await fetch(`${SB_URL}/rest/v1/distribution_leads?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...h, Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'archived' }),
    });
    return res.status(200).json({ ok: true });
  }

  // ── VERIFY SUBSCRIBER (portal access) ────────────────────────────────────
  if (action === 'verify') {
    const { email, token } = req.query;
    if (!email && !token) return res.status(400).json({ error: 'email or token required' });
    let url = `${SB_URL}/rest/v1/distribution_subscribers?status=eq.active&select=id,name,email,access_token`;
    if (token) url += `&access_token=eq.${token}`;
    else url += `&email=eq.${encodeURIComponent(email)}`;
    const r = await fetch(url, { headers: h });
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows[0]) return res.status(403).json({ ok: false, error: 'Not an active subscriber' });
    return res.status(200).json({ ok: true, subscriber: { name: rows[0].name, email: rows[0].email, token: rows[0].access_token } });
  }

  // ── GET SUBSCRIBERS ───────────────────────────────────────────────────────
  if (action === 'subscribers') {
    const r = await fetch(`${SB_URL}/rest/v1/distribution_subscribers?order=created_at.desc`, { headers: h });
    const subs = await r.json();
    return res.status(200).json({ ok: true, subscribers: Array.isArray(subs) ? subs : [] });
  }

  // ── ADD SUBSCRIBER ────────────────────────────────────────────────────────
  if (action === 'add-subscriber' && req.method === 'POST') {
    const { name, email, plan_price, square_customer_id, next_billing_date, notes } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });
    const r = await fetch(`${SB_URL}/rest/v1/distribution_subscribers`, {
      method: 'POST',
      headers: { ...h, Prefer: 'return=representation' },
      body: JSON.stringify({ name, email, plan_price: plan_price || 99, square_customer_id, next_billing_date, notes }),
    });
    const data = await r.json();
    if (!r.ok || !Array.isArray(data) || !data[0]) {
      return res.status(502).json({ ok: false, error: (data && data.message) || 'Insert failed' });
    }
    const sub = data[0];

    // Send welcome email with portal access link
    if (resendKey && sub?.access_token) {
      const portalLink = `https://evan-enterprises-os.vercel.app/leads?token=${sub.access_token}`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Sean @ Evan Enterprises <leads@evanenterprise.com>',
          to: [email],
          subject: 'Welcome — Your Distribution Leads Access',
          html: `
            <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0A0F1E;border-radius:12px;overflow:hidden">
              <div style="padding:28px 32px;border-bottom:1px solid rgba(255,255,255,0.08)">
                <div style="color:#3B82F6;font-size:13px;font-weight:700;letter-spacing:0.12em;margin-bottom:4px">EVAN ENTERPRISES LLC</div>
                <div style="color:#fff;font-size:22px;font-weight:700">Welcome, ${name.split(' ')[0]}.</div>
              </div>
              <div style="padding:28px 32px">
                <p style="color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;margin:0 0 24px">
                  You're now subscribed to our monthly distribution leads. Every month you'll get curated product opportunities with full ROI and profit data — ready to list on Amazon or Walmart.
                </p>
                <a href="${portalLink}" style="display:block;background:#3B82F6;color:#fff;padding:16px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;text-align:center;margin-bottom:20px">
                  View Your Leads →
                </a>
                <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:0">
                  This link is unique to your account. Don't share it. Questions? Reply to this email.
                </p>
              </div>
            </div>
          `,
        }),
      }).catch(() => {});
    }

    return res.status(200).json({ ok: true, subscriber: sub });
  }

  // ── UPDATE SUBSCRIBER ─────────────────────────────────────────────────────
  if (action === 'update-subscriber' && req.method === 'POST') {
    const { id, ...fields } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    await fetch(`${SB_URL}/rest/v1/distribution_subscribers?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...h, Prefer: 'return=minimal' },
      body: JSON.stringify(fields),
    });
    return res.status(200).json({ ok: true });
  }

  // ── SEND BLAST ────────────────────────────────────────────────────────────
  if (action === 'send-blast' && req.method === 'POST') {
    if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY not set' });

    // Get active subscribers
    const subRes = await fetch(`${SB_URL}/rest/v1/distribution_subscribers?status=eq.active`, { headers: h });
    const subs   = await subRes.json();
    if (!Array.isArray(subs) || !subs.length) return res.status(200).json({ ok: true, sent: 0, message: 'No active subscribers' });

    // Get active leads
    const leadsRes = await fetch(`${SB_URL}/rest/v1/distribution_leads?status=eq.active&order=created_at.desc`, { headers: h });
    const leads    = await leadsRes.json();
    if (!Array.isArray(leads) || !leads.length) return res.status(200).json({ ok: true, sent: 0, message: 'No active leads to send' });

    const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

    function leadCard(lead) {
      const roi    = lead.buy_price ? (((lead.sell_price - lead.buy_price) / lead.buy_price) * 100).toFixed(0) : '—';
      const profit = lead.buy_price ? (lead.sell_price - lead.buy_price).toFixed(2) : '—';
      return `
        <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:16px">
          ${lead.image_url ? `<img src="${lead.image_url}" alt="${lead.title}" style="width:100%;height:180px;object-fit:cover;display:block">` : `<div style="width:100%;height:80px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px">No image</div>`}
          <div style="padding:16px">
            <div style="font-size:11px;font-weight:600;color:#3B82F6;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">${lead.platform || 'Amazon'} · ${lead.category || 'General'}</div>
            <div style="font-size:16px;font-weight:700;color:#111;margin-bottom:12px;line-height:1.3">${lead.title}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div style="background:#f9fafb;border-radius:6px;padding:10px;text-align:center">
                <div style="font-size:10px;color:#6b7280;margin-bottom:2px">Buy Price</div>
                <div style="font-size:16px;font-weight:700;color:#111">$${Number(lead.buy_price).toFixed(2)}</div>
              </div>
              <div style="background:#f9fafb;border-radius:6px;padding:10px;text-align:center">
                <div style="font-size:10px;color:#6b7280;margin-bottom:2px">Sell Price</div>
                <div style="font-size:16px;font-weight:700;color:#111">$${Number(lead.sell_price).toFixed(2)}</div>
              </div>
              <div style="background:#ECFDF5;border-radius:6px;padding:10px;text-align:center">
                <div style="font-size:10px;color:#065f46;margin-bottom:2px">Est. Profit</div>
                <div style="font-size:16px;font-weight:700;color:#059669">$${profit}</div>
              </div>
              <div style="background:#EFF6FF;border-radius:6px;padding:10px;text-align:center">
                <div style="font-size:10px;color:#1e40af;margin-bottom:2px">ROI</div>
                <div style="font-size:16px;font-weight:700;color:#2563EB">${roi}%</div>
              </div>
            </div>
            ${lead.monthly_sales ? `<div style="margin-top:8px;font-size:12px;color:#6b7280">~${lead.monthly_sales.toLocaleString()} units/mo · Competition: ${lead.competition || 'Medium'}</div>` : ''}
          </div>
        </div>`;
    }

    const leadsHtml = leads.map(leadCard).join('');
    const results = [];

    for (const sub of subs) {
      const portalLink = `https://evan-enterprises-os.vercel.app/leads?token=${sub.access_token}`;
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Sean @ Evan Enterprises <leads@evanenterprise.com>',
            to: [sub.email],
            subject: `${month} Distribution Leads — ${leads.length} new opportunities`,
            html: `
              <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto">
                <div style="background:#0A0F1E;padding:24px 28px;border-radius:12px 12px 0 0">
                  <div style="color:#3B82F6;font-size:11px;font-weight:700;letter-spacing:0.12em;margin-bottom:4px">EVAN ENTERPRISES LLC</div>
                  <div style="color:#fff;font-size:20px;font-weight:700">${month} Leads</div>
                  <div style="color:rgba(255,255,255,0.5);font-size:13px;margin-top:4px">${leads.length} curated product opportunities</div>
                </div>
                <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px">
                  <p style="font-size:14px;color:#374151;margin:0 0 20px">Hi ${sub.name.split(' ')[0]}, here are this month's distribution leads. Each one has been vetted for margin and demand.</p>
                  ${leadsHtml}
                  <div style="margin-top:20px;text-align:center">
                    <a href="${portalLink}" style="display:inline-block;background:#0A0F1E;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">View All in Portal →</a>
                  </div>
                  <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:16px">Evan Enterprises LLC · Reply to unsubscribe</p>
                </div>
              </div>`,
          }),
        });
        const d = await r.json();
        results.push({ subscriber: sub.name, ok: !!d.id });
      } catch (e) {
        results.push({ subscriber: sub.name, ok: false, error: e.message });
      }
    }

    const sent = results.filter(r => r.ok).length;
    return res.status(200).json({ ok: true, sent, total: subs.length, results });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
