# Evan Enterprises Homepage Revamp — Design Spec

## Context

The current `index.html` ("Dispatch" design system) pitches three services as equal front doors: AI Front Desk, Marketing, and Distribution. Sean wants to reposition the public homepage around what he actually wants to be known for and sell going forward: **Marketing** — an umbrella offer covering ad management (Google + Instagram), website building, content creation, and UGC work featuring his own personal Instagram/TikTok/YouTube presence — all performed personally, not through an agency structure.

**Chatbot call-out dropped (revised 2026-09-18):** the existing chat widget embedded on the homepage (bottom of `index.html`) turned out to be a third-party GoHighLevel widget hardcoded to a fictional "Lone Star Plumbing" demo sub-account, not a real Evan Enterprises chatbot config. Presenting a "Try my AI chat" call-out pointing at it would mean visitors get answers from a fake plumbing business instead of anything about Sean's actual services. Decision: remove that widget script and skip the chatbot call-out entirely for this revamp. Revisit later once there's a real bot config for Evan Enterprises to point to.

**Scope boundary:** this spec covers `index.html` only — copy, layout, and visual system. It does **not** touch:
- The chat agent's backend logic (`api/agent.js`) — not used by this revamp at all now that the chatbot call-out is dropped
- The Distribution leads portal, subscriber system, or any related API actions
- The admin dashboard (`dashboard/index.html`) or client portal (`portal/index.html`)

Those systems keep running as-is for existing clients/subscribers. Winding them down (cancelling subscriptions, removing the agent from client sites) is a separate decision to be made explicitly later, not a side effect of this homepage rewrite.

## Positioning (revised 2026-09-18)

Homepage sells **one main offer — Marketing** — broken into four sub-services, rather than equal separate pillars:
1. **Ad Management** — Google Ads + Instagram
2. **Website Building** — custom site builds
3. **Content Creation** — general brand/marketing content
4. **UGC Work** — video content, backed by Sean's own Instagram/TikTok/YouTube as personal proof

These four render as a sub-grid/list under one "Marketing" section, not as four equal homepage pillars — Marketing is the headline offer, the four are how it's delivered.

No chatbot call-out this pass (see "Chatbot call-out dropped" above).

Copy voice throughout emphasizes the solo-operator angle ("no account managers, no hand-offs — I build it myself") as the differentiator.

## Page Structure

1. **Hero** — Statement headline positioning Sean as a one-person Marketing operator (ads, sites, content, UGC), sub-line reinforcing the solo-operator angle, two CTAs ("See my work →", "Book a call →")
2. **Marketing section** (navy panel) — headline + intro pitch for Marketing as the umbrella offer, then a 4-item sub-grid:
   - **Ad Management** — proof: Mediterranean Spa Google Ads case study. **Caveat: that account was suspended for "Unacceptable business practices: Phishing" in Aug 2026 — confirm it's active and healthy again before publishing real metrics/claims tied to it. If unresolved, use capability/process framing instead of a results claim.**
   - **Website Building** — proof: live link to the Legacy Hardscape ATX site (now a standalone project at `~/Desktop/legacy-hardscape`, no longer inside this repo — link to the live domain, not a local path)
   - **Content Creation** — general framing, no specific case study required
   - **UGC Work** — proof: headline stat(s) pulled directly onto the card (e.g. "5.9M+ organic views", "30.9K TikTok") rather than a bare link, sourced from Sean's existing media kit at `seanjevangelista-pixel.github.io/seanjayme` — plus a "See full media kit →" link out to that site for rates/full stats, and explicit mention of Instagram/TikTok/YouTube as where his personal content lives
3. **About** — reuse existing section (photo, bio, tags, UGC link) largely as-is, restyled to the new palette/type
4. **Contact** — reuse existing form as-is, restyled. Remove the `svc-pick` service-picker buttons (AI Front Desk / Marketing / Distribution) entirely — the existing free-text "What do you need?" message field already captures which service someone wants, so no replacement picker is needed
5. **Footer** — simplified; remove Distribution/old AI Front Desk links. Remove the GoHighLevel chat widget `<script>` tag entirely (see "Chatbot call-out dropped" above)

## Visual System

**Colors:**
- Ground: `#0A0A0C` (near-black)
- Alternating panel: `#0F1B33` (deep navy)
- Primary type: `#F7F7F5` (white)
- Secondary/body type: `#9A9C9F` (warm gray)
- Accent: `#3B5BDB` (blue) — used sparingly: eyebrow labels, CTA arrows/underlines, links. Not used in large body/headline text.

**Typography:**
- Single typeface: IBM Plex Sans (weights 400/500/600/700) for all headings and body copy — no serif, no italic accent treatment (tried in an earlier mockup pass, rejected as too ornamental for the "simple" direction Sean wants)
- IBM Plex Mono retained for small uppercase eyebrow/label text only (ties back to the current site's existing type system)

**Motion:**
- Keep the existing scroll-reveal pattern (`.rv` class / IntersectionObserver, respecting `prefers-reduced-motion`) already used across the site
- Remove the "Today's Board" live call-flipping animation entirely — it's AI Front Desk-specific and has no place in the new positioning

## Proof Content Summary

| Sub-service | Proof |
|---|---|
| Ad Management | Mediterranean Spa Google Ads results (pending account-health confirmation — see caveat above) |
| Website Building | Live link to Legacy Hardscape ATX site |
| Content Creation | No specific case study — general capability framing |
| UGC Work | Headline stats on-card (5.9M+ organic views / 30.9K TikTok) + "See full media kit →" link to `seanjevangelista-pixel.github.io/seanjayme` + Instagram/TikTok/YouTube mention |

## Out of Scope / Follow-ups

- Deciding the actual fate of Distribution as a product line (keep running quietly vs. formal sunset) — separate conversation
- Building a real Evan-Enterprises-specific chatbot config to eventually reintroduce a "Try my AI chat" call-out — not part of this revamp
- Confirming Mediterranean Spa's Google Ads account is unsuspended before publishing specific metrics
- Any changes to `dashboard/index.html`, `portal/index.html`, or the chat agent's backend logic (`api/agent.js`)
