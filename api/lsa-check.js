// api/lsa-check.js
// Scheduled stub for checking a Gmail inbox for forwarded LSA lead emails.
//
// TODO: To enable Gmail polling, you will need:
//   1. A Google Cloud project with the Gmail API enabled
//   2. OAuth 2.0 credentials (client ID + secret) stored as env vars:
//        GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
//   3. A dedicated Gmail address (e.g. leads@evanenterprise.com) that receives
//      forwarded LSA notification emails from clients
//   4. Logic to:
//      a. Exchange refresh token for access token via Google OAuth token endpoint
//      b. Call Gmail API: GET /gmail/v1/users/me/messages?q=is:unread label:lsa-leads
//      c. For each unread message, fetch full message body
//      d. POST to /api/lsa-webhook with { to, from, subject, text } payload
//      e. Mark messages as read after processing
//
// Until Gmail polling is configured, use webhook forwarding instead:
//   Forward LSA emails to leads@evanenterprise.com and Resend will
//   POST them to https://evan-enterprises-os.vercel.app/api/lsa-webhook


export default async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    message: 'Gmail polling not yet configured — use webhook forwarding instead',
    instructions: {
      step1: 'In Gmail or Google LSA settings, set up email forwarding to leads@evanenterprise.com',
      step2: 'In Resend dashboard, configure inbound email routing for leads@evanenterprise.com',
      step3: 'Set the webhook destination to https://evan-enterprises-os.vercel.app/api/lsa-webhook',
      step4: 'Leads will auto-appear in the dashboard LSA Leads tab',
    },
  });
}
