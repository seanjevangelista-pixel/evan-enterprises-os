# Evan Enterprises OS — Claude Instructions

## What This Project Is
A business management OS built for Evan Enterprises LLC. Sean manages marketing, ads, operations, invoicing, and reporting for small businesses. This software is the backend brain — dashboard, client portal, distribution leads system, and all API integrations.

## Tech Stack
- Vanilla HTML/CSS/JS (no framework, no build step)
- Vercel serverless functions (`api/*.js`, ES modules)
- Supabase (Postgres + REST API, RLS disabled)
- Resend (transactional email)
- Square (payments)
- Jobber (field operations)
- Google Ads API
- Vercel Hobby plan — max 12 serverless functions (use merged router pattern)

## Key Files
- `dashboard/index.html` — admin dashboard (Sean's view)
- `portal/index.html` — client portal (clients see their data)
- `leads/index.html` — distribution leads portal (subscribers)
- `index.html` — public marketing site (evanenterprise.com)
- `api/agent.js` — AI chat, lead, report, review (action param)
- `api/distribution.js` — leads + subscribers + send-blast
- `api/email.js` — all transactional email actions
- `api/integrations.js` — Google Ads, Jobber, Square, LSA, monthly report, outreach

## API Router Pattern
All endpoints use `?action=` routing. Never create new API files — add actions to existing ones. Max 6 API files total.

## Business Context
- **Clients**: Premier Landscaping ATX (Austin TX), Mediterranean Spa (Baltimore MD)
- **Distribution**: Subscription product leads service ($99/mo), subscribers get Amazon/Walmart product leads with ROI data
- **Sean's email**: seanjevangelista@gmail.com / seanjayme@evanenterprise.com

## Available Skills — When to Use Them

### Design & UI
- **frontend-design** — any new page, section redesign, or visual direction decision
- **ui-ux-pro-max** — color palettes, font pairings, industry-specific UI patterns
- **gsap** — animations, scroll effects, page transitions
- **shadcn** — if/when project migrates to React/Next.js
- **material-3** — Android/mobile UI (future mobile app)
- **swiftui** — iOS app (future)

### Sales & Outreach (for Sean's own business development)
- **outreach-sequence-builder** — build email/DM sequences to prospect new clients
- **cold-email-verifier** — verify leads before outreach
- **copywriting** / **human-tone** — write client-facing copy, proposals, emails
- **sales-psychology** / **objection-handling** — handle client objections on sales calls
- **lead-qualification** / **qualifying-leads** — evaluate inbound leads
- **closing** / **negotiation** — close deals, handle pricing conversations
- **pricing-negotiation** / **pricing-discussion-logic** — respond to "can you do it cheaper?"
- **discovery** / **asking-effective-questions** — run better strategy calls
- **building-rapport** / **active-listening** — connect with prospects
- **social-selling** / **linkedin-post-generator** — grow presence on LinkedIn
- **follow-up-discipline** / **ghost-recovery-sequences** — chase unresponsive leads
- **storytelling** / **presentation-skills** — pitch deck, client presentations
- **proposal** → use `api/email.js?action=proposal`

### Content & Marketing (for Sean + client content)
- **cook-the-blog** / **noise2blog** — turn notes/transcripts into blog posts
- **email-newsletter** / **email-sequence** — nurture sequences for clients
- **linkedin-post-generator** / **noise-to-linkedin-carousel** — LinkedIn content
- **tweet-thread-from-blog** — repurpose blog content to Twitter
- **copywriting** / **copy-editing** — website copy, ad copy
- **brand-alchemy** — brand naming, positioning for new clients
- **geo-gap-fixer** — GEO/AI visibility audit for client websites
- **llms-txt-generator** — generate llms.txt for client sites
- **schema-markup-generator** — JSON-LD schema for SEO

### Analytics & Intelligence
- **competitive-intelligence-gathering** / **competitive-positioning** — research competitors for clients
- **sentiment-analysis** / **sentiment-trend-tracking** — monitor client brand sentiment
- **analytics-tracking** / **performance-analytics** — set up tracking, interpret data
- **map-your-market** / **where-your-customer-lives** — ICP research for new clients
- **company-radar** / **trigger-event-detection** — monitor prospects for buying signals
- **hackernews-intel** / **reddit-icp-monitor** — find leads in communities

### Client Management & Operations
- **customer-onboarding** — build better client onboarding flows
- **deal-documentation** — document scope, agreements
- **pipeline-management** — manage sales pipeline
- **meeting-brief-generator** / **post-meeting-follow-up-automation** — before/after client calls
- **time-management** / **time-to-close-prediction** — prioritize deals

### Distribution Business (product leads service)
- **pricing-page-psychology-audit** — audit the distribution leads pricing page
- **social-proof-injection** — add testimonials/proof to the leads portal
- **urgency-creation** / **scarcity-urgency-calibration** — drive subscription conversions
- **email-sequence** — drip sequence for distribution subscribers
- **micro-commitment-stacking** — convert free/trial users to paid

### Dev Workflow
- **pr-description-writer** — write PR descriptions before pushing
- **docs-from-code** — generate docs from existing API files
- **dependency-update-bot** — keep packages current
- **explain-this-pr** — understand incoming changes

## Rules
- Never exceed 12 Vercel functions — add actions to existing API files
- No frameworks — vanilla HTML/CSS/JS only until a migration is planned
- Dark design system: `#0A0F1E` bg, `#111827` surface, `#3B82F6` accent
- Supabase anon key is public-safe; service key is server-only
- Always commit with co-author: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
