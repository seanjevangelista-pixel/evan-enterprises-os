// api/outreach-send.js
// Sends personalized cold emails to a list of prospects and logs them in Supabase.
//
// SQL to create the outreach_leads table in Supabase:
// -----------------------------------------------------------------------------
// create table if not exists outreach_leads (
//   id uuid primary key default gen_random_uuid(),
//   business_name text not null,
//   owner_name text,
//   email text not null,
//   phone text,
//   city text,
//   niche text,
//   status text default 'pending', -- pending, sent, replied, converted, unsubscribed
//   notes text,
//   last_emailed_at timestamptz,
//   follow_up_count int default 0,
//   created_at timestamptz default now()
// );
// -----------------------------------------------------------------------------

export const config = { maxDuration: 60 };

function buildInitialEmail({ businessName, ownerName, city, niche, painPoint }) {
  const firstName = ownerName ? ownerName.split(' ')[0] : 'there';
  const nicheLabel = niche || 'local service';
  const cityLabel  = city  || 'your area';
  const pain       = painPoint || 'missing out on leads because their digital presence isn\'t keeping up';

  const subject = `Quick question about ${businessName}'s online presence`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#F1F5F9;font-family:Inter,-apple-system,Arial,sans-serif">
<div style="max-width:540px;margin:0 auto">

  <div style="background:#0A0F1E;border-radius:12px 12px 0 0;padding:20px 24px;display:flex;align-items:center;gap:14px">
    <svg width="28" height="22" viewBox="0 0 104 84" xmlns="http://www.w3.org/2000/svg">
      <path d="M 0,20 L 14,0 L 86,0 Q 104,0 104,10 Q 104,20 86,20 Z" fill="#3B82F6"/>
      <path d="M 0,52 L 14,32 L 86,32 Q 104,32 104,42 Q 104,52 86,52 Z" fill="#2563EB"/>
      <path d="M 0,84 L 14,64 L 86,64 Q 104,64 104,74 Q 104,84 86,84 Z" fill="#1D4ED8"/>
    </svg>
    <div>
      <div style="color:#fff;font-size:13px;font-weight:700;letter-spacing:0.12em">EVAN ENTERPRISES LLC</div>
      <div style="color:#94A3B8;font-size:11px;margin-top:2px">Business Growth & Digital Operations</div>
    </div>
  </div>

  <div style="background:#fff;padding:28px;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px">
    <p style="font-size:14px;color:#0F172A;line-height:1.7;margin:0 0 16px">Hey ${firstName},</p>

    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px">
      I came across <strong>${businessName}</strong> while looking at ${nicheLabel} businesses in ${cityLabel} — wanted to reach out directly.
    </p>

    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px">
      Most ${nicheLabel} businesses in ${cityLabel} are losing leads right now because ${pain}. It's not a business problem — it's a visibility and systems problem, and it's fixable fast.
    </p>

    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px">
      At Evan Enterprises, we handle the entire digital side for local businesses — website, Google Ads, lead intake, invoicing, monthly reporting. You run the jobs, we run everything else.
    </p>

    <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:8px;padding:16px 20px;margin:20px 0">
      <div style="font-size:12px;font-weight:700;color:#0369A1;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">What We Do For Clients</div>
      <p style="font-size:13px;color:#0F172A;line-height:1.6;margin:0">
        We currently manage <strong>Premier Landscaping ATX</strong> — handling their entire operation: Google Ads, LSA, website, invoicing via Jobber, and monthly performance reports. They focus on the work; we handle the rest.
      </p>
    </div>

    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 20px">
      Would it make sense to jump on a quick 15-min call this week? No pitch deck, no pressure — just want to see if there's a fit.
    </p>

    <div style="border-top:1px solid #E2E8F0;padding-top:20px;display:flex;align-items:center;gap:14px">
      <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#3B82F6);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px;flex-shrink:0">SE</div>
      <div>
        <div style="font-size:13px;font-weight:600;color:#0F172A">Sean Evangelista</div>
        <div style="font-size:12px;color:#64748B">Evan Enterprises LLC</div>
        <div style="font-size:12px;color:#64748B">sean@evanenterprise.com</div>
      </div>
    </div>
  </div>

</div>
</body></html>`;

  return { subject, html };
}

function buildFollowUpEmail({ businessName, ownerName, city }) {
  const firstName = ownerName ? ownerName.split(' ')[0] : 'there';
  const cityLabel  = city || 'your area';

  const subject = `Re: Quick question about ${businessName}'s online presence`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#F1F5F9;font-family:Inter,-apple-system,Arial,sans-serif">
<div style="max-width:540px;margin:0 auto">
  <div style="background:#fff;padding:28px;border:1px solid #E2E8F0;border-radius:12px">
    <p style="font-size:14px;color:#0F172A;line-height:1.7;margin:0 0 14px">Hey ${firstName},</p>
    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 14px">
      Just wanted to follow up on my last email — I know inboxes get busy.
    </p>
    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 14px">
      Happy to show you exactly what we do for a similar business in ${cityLabel} — real numbers, real results. Worth a quick call?
    </p>
    <div style="border-top:1px solid #E2E8F0;padding-top:18px;display:flex;align-items:center;gap:12px">
      <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#1D4ED8,#3B82F6);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:13px;flex-shrink:0">SE</div>
      <div>
        <div style="font-size:13px;font-weight:600;color:#0F172A">Sean — Evan Enterprises LLC</div>
        <div style="font-size:12px;color:#64748B">sean@evanenterprise.com</div>
      </div>
    </div>
  </div>
</div>
</body></html>`;

  return { subject, html };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { leads = [], followUp = false } = req.body || {};
  if (!leads.length) return res.status(400).json({ error: 'No leads provided' });

  const resendKey   = process.env.RESEND_API_KEY;
  const supabaseUrl = 'https://hzcgdnhecgewqpcnumwm.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY not set' });

  const results = [];
  let sent = 0;

  for (const lead of leads) {
    const { businessName, ownerName, email, city, niche, painPoint } = lead;
    if (!email || !businessName) {
      results.push({ email, ok: false, error: 'Missing email or businessName' });
      continue;
    }

    const { subject, html } = followUp
      ? buildFollowUpEmail({ businessName, ownerName, city })
      : buildInitialEmail({ businessName, ownerName, city, niche, painPoint });

    // Send via Resend
    let emailResult;
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    'Sean Evangelista <sean@evanenterprise.com>',
          to:      [email],
          subject,
          html,
        }),
      });
      emailResult = await r.json();
    } catch (e) {
      emailResult = { error: e.message };
    }

    const emailOk = !emailResult.error;
    if (emailOk) sent++;

    // Upsert lead in Supabase
    if (supabaseKey) {
      try {
        const now = new Date().toISOString();
        // Try update first (by email), then insert if not found
        const upsertRes = await fetch(`${supabaseUrl}/rest/v1/outreach_leads?email=eq.${encodeURIComponent(email)}`, {
          method: 'PATCH',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            status: 'sent',
            last_emailed_at: now,
            ...(followUp ? { follow_up_count: 1 } : {}),
          }),
        });

        const updated = await upsertRes.json();

        if (!updated || (Array.isArray(updated) && updated.length === 0)) {
          // No existing row — insert new
          await fetch(`${supabaseUrl}/rest/v1/outreach_leads`, {
            method: 'POST',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({
              business_name: businessName,
              owner_name: ownerName || null,
              email,
              city: city || null,
              niche: niche || null,
              status: 'sent',
              last_emailed_at: now,
              follow_up_count: followUp ? 1 : 0,
            }),
          });
        }
      } catch (e) {
        // Non-fatal — email already sent
        console.error('Supabase upsert error:', e.message);
      }
    }

    results.push({ email, businessName, ok: emailOk, resend: emailResult });
  }

  return res.status(200).json({ ok: true, sent, results });
}
