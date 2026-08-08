# Legacy Hardscape ATX — Client Reference

Status: **Full client** (per Sean, 2026-08-06) — website + AI bot built. Added to the internal client system (Supabase `clients` table) on 2026-08-06 at **$750/mo**.

## Business Basics

- **Business name:** Legacy Hardscape ATX
- **Industry:** Hardscaping & outdoor living contractor
- **Service area:** Austin, TX and the surrounding metro (specific counties not yet confirmed)
- **Phone:** (737) 428-4707
- **Email:** legacyhardscapeatx@gmail.com
- **Positioning:** Premium — real Austin projects (no stock photography), "engineered to last" / "built to endure" tone, targets $5,000+ projects

## Services (11, grouped)

- **Hardscape:** Driveways, Patios, Walkways, Stained Concrete
- **Outdoor Living:** Pergolas, Outdoor Kitchens, Fire Pits
- **Landscape:** Turf Installation, Sod Installation, Plant Installation, Tree Removal

## Website

Code lives inside this repo at `legacy-hardscape/`, deployed on the Evan Enterprises Vercel project, but served on its **own domain** via host-based rewrites in `vercel.json` (registered through Vercel directly, not a separate registrar).

| Page | Live URL |
|---|---|
| Home | legacyhardscapeatx.com |
| About | legacyhardscapeatx.com/about |
| Contact | legacyhardscapeatx.com/contact |
| Reviews | Not built yet — pending Google Business Profile review link (see Reviews section) |

Old subpath URLs (`evanenterprise.com/legacy-hardscape/...`) now 301-redirect to the new domain — see Domain section.

**Design system:** Warm/premium palette — near-black `#211E1A`, cream `#F7F3EC`, terracotta accent `#D0451B`, gold `#C99A3E`, stone tones `#C9AF88`/`#8B6F47`. Fonts: Playfair Display (display/headings) + Inter (body). Distinct from Evan Enterprises' own "Dispatch" chrome/monochrome branding.

**Photos:** Real client-provided project photos, split from PicCollage exports and organized at `legacy-hardscape/img/site/` (in-use) and `legacy-hardscape/img/raw-source/` (full set, includes a few unused/watermark-affected originals).

**Placeholder content still in use** (flagged honestly, not fabricated):
- Stained Concrete / Sod Installation / Tree Removal service cards use styled icon placeholders (🎨/🌱/🪓), not real project photos yet
- Testimonials section is an honest "no reviews yet" empty state
- No founder bio, company history, or business hours are published anywhere on the site — none of that was confirmed as real, so it was deliberately left out rather than invented

## AI Chatbot

Wired into every page via the shared `bot_profiles` system (`api/agent.js?action=chat`).

- **Slug:** `legacy-hardscape-atx`
- **Config source:** `supabase-bot-profiles.sql` (in repo root) — **must be run in the Supabase SQL editor** for the bot to actually respond with Legacy Hardscape ATX content instead of falling back to the Evan Enterprises default profile. Confirm this has been run.

## Lead Capture

Quote form (`/api/contact-site`) on Home + Contact pages routes submissions to **legacyhardscapeatx@gmail.com** (not Sean's inbox) via a `to` field passed in the request. Fields collected: name, phone, email, city/area, property type, project type, estimated budget, message.

## Google Business Profile

- **Status:** Exists (confirmed by Sean, 2026-08-06)
- **Reviews:** None yet
- **Listing link / Place ID:** Not yet provided — needed to build the "Leave us a Review" CTA and, later, a real reviews page
- **Next step once reviews exist:** build a Supabase `reviews` table (same pattern as `bot_profiles`) that Sean populates manually as real reviews come in — no paid Google Places API needed unless volume justifies it later

## Domain

**Purchased 2026-08-07** — `legacyhardscapeatx.com`, registered directly through Vercel ($11.25/yr, auto-renewal on). Registered under Sean's Vercel account/team (`seanjevangelista-pixel-projects`), not a separate Legacy Hardscape-owned registrar account — worth revisiting later per the earlier discussion about client asset ownership, but fine for now to get it live fast.

Routing: `vercel.json` has host-scoped rewrites so `legacyhardscapeatx.com` serves the `legacy-hardscape/` files at clean root paths (`/`, `/about`, `/contact`), plus permanent redirects from `evanenterprise.com/legacy-hardscape/*` to the new domain.

**Still needs doing in the Vercel dashboard:** click "Connect" on the domain's page to actually attach it to the `evan-enterprises-os` project — the routing config is ready in code, but the domain isn't wired to the project yet as of 2026-08-07.

## Outstanding To-Do

- [x] Buy a domain — `legacyhardscapeatx.com` (done 2026-08-07, via Vercel)
- [ ] **Click "Connect" in Vercel** to attach the domain to the project (Vercel dashboard → Domains → legacyhardscapeatx.com → Connect)
- [ ] Run `supabase-bot-profiles.sql` in Supabase if not already done
- [x] Add Legacy Hardscape ATX as a real client row (done 2026-08-06, $750/mo)
- [ ] Get the real Google Business Profile listing link/Place ID → build "Leave a Review" CTA
- [ ] Build a dedicated Reviews page once the above is in place
- [ ] Real photos for Stained Concrete, Sod Installation, Tree Removal (currently icon placeholders)
- [ ] Real business hours, founder bio/history, and social media links if Sean wants those published (currently omitted rather than guessed)
- [ ] Consider moving domain registration to a Legacy Hardscape-owned account (currently under Sean's Vercel team)

## Key Files (in this repo)

- `legacy-hardscape/index.html` — homepage
- `legacy-hardscape/about/index.html` — About page
- `legacy-hardscape/contact/index.html` — Contact page
- `legacy-hardscape/img/site/` — photos in active use
- `legacy-hardscape/img/raw-source/` — full photo set
- `supabase-bot-profiles.sql` — chatbot config (includes this client's profile)
- `api/contact-site.js` — quote form backend (shared with main Evan Enterprises site)
- `docs/superpowers/specs/2026-08-06-legacy-hardscape-atx-design.md` — original design spec from the build
