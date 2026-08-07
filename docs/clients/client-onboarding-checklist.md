# New Client Onboarding Checklist

Copy this into a new `docs/clients/<client-slug>.md` file for every new client and work through it top to bottom.

## 1. Intake
- [ ] Confirm scope + monthly fee/services with client
- [ ] Collect business info: name, contact, service area, phone, email
- [ ] Collect branding: logo, colors, existing photos
- [ ] Get Google Business Profile link (for future review CTA — never fabricate reviews/hours/bio)

## 2. Marketing Site
- [ ] Pick/confirm design system (colors, type pairing) via `frontend-design` skill
- [ ] Build pages: Home, About, Contact (+ any service pages)
- [ ] Wire quote/contact form to client's email via `api/email.js`
- [ ] Add real project photos (no placeholders in final version)

## 3. AI Chatbot
- [ ] Add client row to Supabase `bot_profiles` table (see `supabase-bot-profiles.sql`)
- [ ] Wire chatbot on site via `botSlug` param
- [ ] Test chat responses for accuracy against client's actual services

## 4. Domain
- [ ] Buy domain (Vercel registrar preferred — auto-connects, no DNS setup)
- [ ] Connect domain to Vercel project
- [ ] Verify SSL/HTTPS resolves

## 5. Admin & Portal
- [ ] Add client in `/admin` → Add Client (set monthly fee/services)
- [ ] Set up client portal access (`portal/index.html`)

## 6. QA Pass
- [ ] Test quote form end-to-end (submission → email received)
- [ ] Test chatbot on mobile + desktop
- [ ] Check responsive layout on mobile/tablet
- [ ] Run through every nav link/page

## 7. Go Live
- [ ] Push to `main`
- [ ] Share live URL with client
- [ ] Save client reference doc in `docs/clients/<client-slug>.md`
