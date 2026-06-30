// Agent 3: Review Request
// Called when a visit is logged — sends SMS to customer asking for a Google review
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const twilioSid   = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom  = process.env.TWILIO_PHONE_NUMBER;

  if (!twilioSid || !twilioToken || !twilioFrom) {
    return res.status(200).json({ configured: false });
  }

  const { customer_name, customer_phone, business_name, review_link } = req.body || {};

  if (!customer_phone) return res.status(400).json({ error: 'customer_phone required' });

  const firstName = (customer_name || 'there').split(' ')[0];
  const biz = business_name || 'us';
  const link = review_link || 'https://g.page/r/review';

  try {
    const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        From: twilioFrom,
        To: customer_phone,
        Body: `Hi ${firstName}! Thank you for visiting ${biz} today. If you enjoyed your experience, we'd love a quick Google review — it means a lot to us! ${link}\n\nReply STOP to opt out.`,
      }),
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
