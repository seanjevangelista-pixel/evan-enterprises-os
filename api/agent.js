// api/agent.js — merged from agent-chat, agent-lead, agent-report, agent-review
// Route via: /api/agent?action=chat|lead|report|review

// ── SUPABASE HELPERS (shared across agents) ──
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hzcgdnhecgewqpcnumwm.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

// Code-level ultimate fallback — guarantees Agent 4 never breaks even if
// bot_profiles hasn't been migrated yet or Supabase is unreachable.
// Mirrors the prompt that used to be hardcoded directly in this file.
const DEFAULT_BOT_PROFILE = {
  slug: 'evan-enterprises',
  business_name: 'Evan Enterprises LLC',
  industry: 'marketing and distribution agency',
  services: [
    { name: 'Starter', desc: '$500/mo + 10% — Google LSA, Google Business Profile, review automation, SMS reactivation, monthly reports' },
    { name: 'Growth', desc: '$900/mo + 10% — Everything in Starter + Google Ads, referral program, UGC content, Apple Maps, bi-weekly calls' },
    { name: 'Multi-location', desc: '$1,300/location — Google Ads per location, unified reporting, cross-location strategy' },
    { name: 'Distribution', desc: 'Custom — Amazon/Walmart product sourcing and placement' },
  ],
  pricing: null,
  key_facts: [
    "Ad spend always goes on the client's card, never ours",
    '10% performance fee applies to revenue from retained clients we bring in',
    'Free 30-minute strategy call to get started',
    'Book at: https://calendar.google.com (or tell them to email sean@evanenterprise.com)',
    'Current client: Mediterranean Spa, Baltimore MD — 34 leads in month 1 at $26.47 CPL',
  ].join('\n'),
  tone: 'concise, professional, and helpful',
  booking_link: 'https://calendar.google.com',
  is_demo: false,
};

async function fetchBotProfile(slug) {
  if (!slug) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bot_profiles?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`, { headers: sbHeaders });
    const rows = await r.json();
    return Array.isArray(rows) ? (rows[0] || null) : null;
  } catch (_) {
    return null;
  }
}

// Looks up a profile by slug; falls back to the seeded 'evan-enterprises'
// row, then to the code-level DEFAULT_BOT_PROFILE if Supabase is down or
// unmigrated. No botSlug passed => always resolves to Evan Enterprises,
// identical to today's behavior.
async function getBotProfile(slug) {
  return (await fetchBotProfile(slug)) || (await fetchBotProfile('evan-enterprises')) || DEFAULT_BOT_PROFILE;
}

async function fetchClient(clientId) {
  if (!clientId) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/clients?id=eq.${encodeURIComponent(clientId)}&select=*&limit=1`, { headers: sbHeaders });
    const rows = await r.json();
    return Array.isArray(rows) ? (rows[0] || null) : null;
  } catch (_) {
    return null;
  }
}

function buildSystemPrompt(profile) {
  const servicesList = Array.isArray(profile.services) ? profile.services : [];
  const servicesText = servicesList.length
    ? servicesList.map(s => (typeof s === 'string' ? `- ${s}` : `- ${s.name}${s.desc ? ': ' + s.desc : ''}`)).join('\n')
    : '- Ask us about our services';
  const pricingBlock = profile.pricing ? `\n\nPRICING:\n${profile.pricing}` : '';

  return `You are the virtual assistant for ${profile.business_name}${profile.industry ? `, a ${profile.industry}` : ''}.

SERVICES:
${servicesText}${pricingBlock}

KEY FACTS:
${profile.key_facts || '(none listed)'}

RULES:
- Be ${profile.tone || 'concise, professional, and friendly'}
- If they ask to book, share this link: ${profile.booking_link || 'ask them to contact us directly'}
- If they ask for pricing, explain it clearly using only what's listed above
- If they provide their name/email/phone, acknowledge it and say the team will follow up
- Never make up information not listed above
- Keep responses under 3 sentences unless explaining a package`;
}

// ── CHAT ──
// Agent 4: Landing Page Chatbot
// Answers questions about the configured business (via botSlug -> bot_profiles) using OpenAI
async function handle_agent_chat(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return res.status(200).json({ configured: false });

  const { messages = [], lead = {}, botSlug } = req.body || {};
  const profile = await getBotProfile(botSlug);
  const system = buildSystemPrompt(profile);

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: system }, ...messages],
        max_tokens: 200,
        temperature: 0.7,
      }),
    });
    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content || 'Sorry, I ran into an issue. Email us at sean@evanenterprise.com';

    // If lead info provided, notify Sean via email (fire and forget)
    if (lead.email || lead.phone) {
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        const tag = profile.is_demo ? '[DEMO] ' : '';
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Evan Enterprises Chat <chat@evanenterprise.com>',
            to: ['seanjevangelista@gmail.com'],
            subject: `${tag}New chat lead — ${profile.business_name} — ${lead.name || lead.email}`,
            html: `<p><b>Business:</b> ${profile.business_name}<br><b>Name:</b> ${lead.name || '—'}<br><b>Email:</b> ${lead.email || '—'}<br><b>Phone:</b> ${lead.phone || '—'}</p>`,
          }),
        }).catch(() => {});
      }
    }

    return res.status(200).json({ reply, configured: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// ── LEAD ──
// Agent 1: LSA Lead Follow-up
// Receives webhook from Google LSA, immediately SMS-notifies the client
async function handle_agent_lead(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const twilioSid    = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken  = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom   = process.env.TWILIO_PHONE_NUMBER;
  const myPhone      = process.env.OWNER_PHONE_NUMBER; // Sean's phone

  if (!twilioSid || !twilioToken || !twilioFrom) {
    return res.status(200).json({ configured: false });
  }

  // Google LSA sends lead data as JSON or form
  const body = req.body || {};
  const leadName    = body.lead_contact_name || body.name || 'New customer';
  const leadPhone   = body.lead_contact_phone || body.phone || '';
  const service     = body.service_type || body.category || 'your service';

  // If a clientId is provided, prefer Supabase's business_name as the
  // source of truth over whatever the webhook payload sent — falls back
  // to the webhook body (today's behavior) when no clientId is given.
  const client  = await fetchClient(body.clientId);
  const business = client?.business_name || body.business_name || 'your business';

  try {
    const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');

    // Twilio signals rejection (bad number, unverified trial account, insufficient
    // balance) with a non-2xx status, not a thrown error — fetch() doesn't throw for
    // that. Not checking the response meant a completely failed send still returned
    // ok:true, so Sean's own lead alert (and the lead's follow-up text) could
    // silently never arrive with no record of why.
    const sendSms = async (to, bodyText) => {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: twilioFrom, To: to, Body: bodyText }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.error_code) {
        console.error('Twilio send failed:', r.status, data.message || data.error_code);
        return { ok: false, error: data.message || `Twilio HTTP ${r.status}` };
      }
      return { ok: true, sid: data.sid };
    };

    // SMS 1: Alert Sean immediately
    const alertResult = await sendSms(
      myPhone,
      `🔔 New LSA lead for ${business}:\n${leadName}${leadPhone ? ' · ' + leadPhone : ''}\nService: ${service}\n\nLog it: evan-enterprises-os.vercel.app/dashboard`
    );

    // SMS 2: Follow-up to the lead (if phone provided)
    let followUpResult = null;
    if (leadPhone) {
      // 2-min delay via scheduling not possible in serverless — send immediately
      followUpResult = await sendSms(
        leadPhone,
        `Hi ${leadName.split(' ')[0]}! Thanks for reaching out to ${business}. We'll be in touch shortly to confirm your appointment. Reply STOP to opt out.`
      );
    }

    const ok = alertResult.ok && (!followUpResult || followUpResult.ok);
    return res.status(ok ? 200 : 502).json({
      ok,
      lead: leadName,
      alertSent: alertResult.ok,
      followUpSent: followUpResult ? followUpResult.ok : null,
      error: ok ? undefined : (alertResult.error || followUpResult?.error),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// ── REPORT ──
// Agent 2: Monthly Report
// Vercel Cron: runs 1st of every month at 8am
// Pulls Square payments + Google Ads data, emails branded PDF to client

async function handle_agent_report(req, res) {
  // Allow manual trigger from dashboard OR cron
  const isCron = req.headers['x-vercel-cron'] === '1';
  // Comparing two undefined values is true, so if INTERNAL_API_KEY was never set
  // in Vercel, req.headers['x-internal-key'] (also undefined when the caller sends
  // no header at all) satisfied this check for every caller — this "protected"
  // report endpoint was wide open by default until someone thought to configure
  // the env var. Requiring the secret to actually be set closes that.
  const isInternal = !!process.env.INTERNAL_API_KEY && req.headers['x-internal-key'] === process.env.INTERNAL_API_KEY;
  if (!isCron && !isInternal) return res.status(401).json({ error: 'Unauthorized' });

  const resendKey   = process.env.RESEND_API_KEY;
  const squareToken = process.env.SQUARE_ACCESS_TOKEN;
  const gadsToken   = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

  if (!resendKey) return res.status(200).json({ configured: false, missing: 'RESEND_API_KEY' });

  // Optional clientId (query param, since cron hits this via GET) — when
  // present, pull business name/recipient/fee dynamically from Supabase.
  // When absent, falls back to today's hardcoded Mediterranean Spa path.
  const client = await fetchClient(req.query?.clientId);
  const clientLabel   = client?.business_name || 'Mediterranean Spa';
  const clientLocale  = client ? '' : ' · Baltimore, MD';
  const clientEmail   = client?.owner_email || process.env.CLIENT_MED_SPA_EMAIL || 'client@example.com';
  const flatFee       = client ? Number(client.monthly_flat_fee || 0) : 500;

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
    <div class="sub">${clientLabel}${clientLocale}</div>
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
        <div class="stat-value">$${(flatFee + squareTotal * 0.1).toFixed(2)}</div>
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
        to: [clientEmail],
        cc: ['seanjevangelista@gmail.com'],
        subject: `${monthLabel} Performance Report — ${clientLabel}`,
        html,
      }),
    });
    const emailData = await emailRes.json();
    return res.status(200).json({ ok: true, month: monthLabel, email: emailData });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// ── REVIEW ──
// Agent 3: Review Request
// Called when a visit is logged — sends SMS to customer asking for a Google review
async function handle_agent_review(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const twilioSid   = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom  = process.env.TWILIO_PHONE_NUMBER;

  if (!twilioSid || !twilioToken || !twilioFrom) {
    return res.status(200).json({ configured: false });
  }

  const { customer_name, customer_phone, business_name, review_link, clientId } = req.body || {};

  if (!customer_phone) return res.status(400).json({ error: 'customer_phone required' });

  // business_name passed explicitly always wins; clientId is just a
  // convenience fallback so callers don't have to look up the name themselves.
  const client = business_name ? null : await fetchClient(clientId);

  const firstName = (customer_name || 'there').split(' ')[0];
  const biz = business_name || client?.business_name || 'us';
  const link = review_link || 'https://g.page/r/review';

  try {
    const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        From: twilioFrom,
        To: customer_phone,
        Body: `Hi ${firstName}! Thank you for visiting ${biz} today. If you enjoyed your experience, we'd love a quick Google review — it means a lot to us! ${link}\n\nReply STOP to opt out.`,
      }),
    });
    // Twilio reports rejection (bad number, unverified trial account, etc.) with a
    // non-2xx status rather than a thrown error, so this always returned ok:true
    // even when the review request never actually went out.
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.error_code) {
      console.error('Twilio send failed:', r.status, data.message || data.error_code);
      return res.status(502).json({ ok: false, error: data.message || `Twilio HTTP ${r.status}` });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}


export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;
  if (action === 'chat')   return handle_agent_chat(req, res);
  if (action === 'lead')   return handle_agent_lead(req, res);
  if (action === 'report') return handle_agent_report(req, res);
  if (action === 'review') return handle_agent_review(req, res);
  return res.status(400).json({ error: 'Unknown action. Use ?action=chat|lead|report|review' });
}
