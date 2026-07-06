// Agent 2: Monthly Report
// Vercel Cron: runs 1st of every month at 8am
// Pulls Square payments + Google Ads data, emails branded PDF to client

export default async function handler(req, res) {
  // Allow manual trigger from dashboard OR cron
  const isCron = req.headers['x-vercel-cron'] === '1';
  const isInternal = req.headers['x-internal-key'] === process.env.INTERNAL_API_KEY;
  if (!isCron && !isInternal) return res.status(401).json({ error: 'Unauthorized' });

  const resendKey   = process.env.RESEND_API_KEY;
  const squareToken = process.env.SQUARE_ACCESS_TOKEN;
  const gadsToken   = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  if (!resendKey) return res.status(200).json({ configured: false, missing: 'RESEND_API_KEY' });

  // ── Date range: last full month ──────────────────────────────────────────
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end   = new Date(now.getFullYear(), now.getMonth(), 0);
  const monthLabel = start.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  let squareTotal = 0, squareTx = 0;
  let gadsSpend = 0, gadsClicks = 0, gadsConversions = 0;

  // ── Pull Square data ─────────────────────────────────────────────────────
  if (squareToken) {
    try {
      const params = new URLSearchParams({
        begin_time: start.toISOString(),
        end_time: end.toISOString(),
        limit: '200',
      });
      const r = await fetch(`https://connect.squareup.com/v2/payments?${params}`, {
        headers: { Authorization: `Bearer ${squareToken}`, 'Square-Version': '2024-01-18' },
      });
      const d = await r.json();
      (d.payments || []).forEach(p => {
        squareTotal += (p.amount_money?.amount || 0) / 100;
        squareTx++;
      });
    } catch (_) {}
  }

  // ── Pull Google Ads data ─────────────────────────────────────────────────
  if (process.env.GOOGLE_ADS_REFRESH_TOKEN) {
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_ADS_CLIENT_ID,
          client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
          refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
          grant_type: 'refresh_token',
        }),
      });
      const { access_token } = await tokenRes.json();
      const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
      const query = `SELECT metrics.cost_micros, metrics.clicks, metrics.conversions FROM customer WHERE segments.date DURING LAST_MONTH`;
      const r = await fetch(`https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:search`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access_token}`, 'developer-token': gadsToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const d = await r.json();
      (d.results || []).forEach(row => {
        gadsSpend       += (row.metrics?.costMicros || 0) / 1e6;
        gadsClicks      += row.metrics?.clicks || 0;
        gadsConversions += row.metrics?.conversions || 0;
      });
    } catch (_) {}
  }

  // ── Build HTML email ─────────────────────────────────────────────────────
  const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:Inter,Arial,sans-serif;background:#F5F7FC;margin:0;padding:32px}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb}
  .header{background:#0D1117;padding:28px 32px;display:flex;align-items:center;gap:12px}
  .header h1{color:#fff;font-size:16px;font-weight:700;margin:0;letter-spacing:0.1em}
  .header .sub{color:#6B7280;font-size:11px;margin-top:2px}
  .body{padding:32px}
  .month{font-size:22px;font-weight:700;color:#0D1117;margin-bottom:4px}
  .sub{color:#6B7280;font-size:13px;margin-bottom:28px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:28px}
  .stat{background:#F5F7FC;border-radius:8px;padding:18px;border:1px solid #e5e7eb}
  .stat-label{font-size:11px;color:#6B7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em}
  .stat-value{font-size:24px;font-weight:700;color:#0D1117}
  .stat-value.green{color:#15803D}
  .stat-value.blue{color:#2563EB}
  .footer{padding:20px 32px;background:#F5F7FC;border-top:1px solid #e5e7eb;font-size:11px;color:#9CA3AF;text-align:center}
</style></head><body>
<div class="wrap">
  <div class="header">
    <div>
      <div class="header h1">EVAN ENTERPRISES LLC</div>
      <div class="sub">Monthly Performance Report</div>
    </div>
  </div>
  <div class="body">
    <div class="month">${monthLabel} Report</div>
    <div class="sub">Mediterranean Spa · Baltimore, MD</div>
    <div class="grid">
      <div class="stat">
        <div class="stat-label">Revenue Collected</div>
        <div class="stat-value green">$${squareTotal.toFixed(2)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Transactions</div>
        <div class="stat-value">${squareTx}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Ad Spend</div>
        <div class="stat-value">$${gadsSpend.toFixed(2)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Clicks</div>
        <div class="stat-value blue">${gadsClicks.toLocaleString()}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Conversions</div>
        <div class="stat-value green">${gadsConversions.toFixed(0)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">My Fee</div>
        <div class="stat-value">$${(500 + squareTotal * 0.1).toFixed(2)}</div>
      </div>
    </div>
    <p style="font-size:13px;color:#6B7280;line-height:1.6">
      This report was automatically generated by Evan Enterprises LLC. 
      For questions, reply to this email or reach out at sean@evanenterprise.com.
    </p>
  </div>
  <div class="footer">Evan Enterprises LLC · www.evanenterprise.com · Confidential</div>
</div>
</body></html>`;

  // ── Send via Resend ──────────────────────────────────────────────────────
  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Evan Enterprises <reports@evanenterprise.com>',
        to: [process.env.CLIENT_MED_SPA_EMAIL || 'client@example.com'],
        cc: ['seanjevangelista@gmail.com'],
        subject: `${monthLabel} Performance Report — Mediterranean Spa`,
        html,
      }),
    });
    const emailData = await emailRes.json();
    return res.status(200).json({ ok: true, month: monthLabel, email: emailData });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
