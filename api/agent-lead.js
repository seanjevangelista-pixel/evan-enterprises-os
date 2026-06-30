// Agent 1: LSA Lead Follow-up
// Receives webhook from Google LSA, immediately SMS-notifies the client
export default async function handler(req, res) {
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
  const business    = body.business_name || 'your business';

  try {
    const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');

    // SMS 1: Alert Sean immediately
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        From: twilioFrom,
        To: myPhone,
        Body: `🔔 New LSA lead for ${business}:\n${leadName}${leadPhone ? ' · ' + leadPhone : ''}\nService: ${service}\n\nLog it: evan-enterprises-os.vercel.app/dashboard`,
      }),
    });

    // SMS 2: Follow-up to the lead (if phone provided)
    if (leadPhone) {
      const clientPhone = process.env.CLIENT_MED_SPA_PHONE || '';
      // 2-min delay via scheduling not possible in serverless — send immediately
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          From: twilioFrom,
          To: leadPhone,
          Body: `Hi ${leadName.split(' ')[0]}! Thanks for reaching out to ${business}. We'll be in touch shortly to confirm your appointment. Reply STOP to opt out.`,
        }),
      });
    }

    return res.status(200).json({ ok: true, lead: leadName });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
