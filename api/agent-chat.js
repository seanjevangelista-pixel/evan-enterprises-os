// Agent 4: Landing Page Chatbot
// Answers questions about Evan Enterprises services using OpenAI
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return res.status(200).json({ configured: false });

  const { messages = [], lead = {} } = req.body || {};

  const system = `You are the virtual assistant for Evan Enterprises LLC, a marketing and distribution agency.

SERVICES:
- Starter: $500/mo + 10% — Google LSA, Google Business Profile, review automation, SMS reactivation, monthly reports
- Growth: $900/mo + 10% — Everything in Starter + Google Ads, referral program, UGC content, Apple Maps, bi-weekly calls
- Multi-location: $1,300/location — Google Ads per location, unified reporting, cross-location strategy
- Distribution: Custom — Amazon/Walmart product sourcing and placement

KEY FACTS:
- Ad spend always goes on the client's card, never ours
- 10% performance fee applies to revenue from retained clients we bring in
- Free 30-minute strategy call to get started
- Book at: https://calendar.google.com (or tell them to email sean@evanenterprise.com)
- Current client: Mediterranean Spa, Baltimore MD — 34 leads in month 1 at $26.47 CPL

RULES:
- Be concise, professional, and helpful
- If they ask to book a call, give them the calendar link
- If they ask for pricing, explain the packages clearly
- If they provide their name/email/phone, acknowledge it and say the team will follow up
- Never make up information not listed above
- Keep responses under 3 sentences unless explaining a package`;

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
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Evan Enterprises Chat <chat@evanenterprise.com>',
            to: ['seanjevangelista@gmail.com'],
            subject: `New chat lead — ${lead.name || lead.email}`,
            html: `<p><b>Name:</b> ${lead.name || '—'}<br><b>Email:</b> ${lead.email || '—'}<br><b>Phone:</b> ${lead.phone || '—'}</p>`,
          }),
        }).catch(() => {});
      }
    }

    return res.status(200).json({ reply, configured: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
