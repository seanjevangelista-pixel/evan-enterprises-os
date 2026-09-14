# Evan Enterprises Homepage Revamp — Design Spec

## Context

The current `index.html` ("Dispatch" design system) pitches three services as equal front doors: AI Front Desk, Marketing, and Distribution. Sean wants to reposition the public homepage around what he actually wants to be known for and sell going forward: **UGC content creation, ad management (Google + Instagram), and website builds** — all performed personally, not through an agency structure.

**Scope boundary:** this spec covers `index.html` only — copy, layout, and visual system. It does **not** touch:
- The AI Front Desk chat agent (`api/agent.js`) or its embedding in existing client sites (e.g. Legacy Hardscape ATX)
- The Distribution leads portal, subscriber system, or any related API actions
- The admin dashboard (`dashboard/index.html`) or client portal (`portal/index.html`)

Those systems keep running as-is for existing clients/subscribers. Winding them down (cancelling subscriptions, removing the agent from client sites) is a separate decision to be made explicitly later, not a side effect of this homepage rewrite.

## Positioning

Homepage sells three **equal pillars**, presented as one person's full-service offering rather than three separate products:
1. **UGC Content** — video content creation for brands
2. **Ads** — Google Ads + Instagram ad management
3. **Websites** — custom site builds

No pillar is positioned as the "main" offer. Copy voice throughout emphasizes the solo-operator angle ("no account managers, no hand-offs — I build it myself") as the differentiator.

## Page Structure

1. **Hero** — Statement headline establishing Sean as the person behind all three services, sub-line reinforcing the solo-operator angle, two CTAs ("See my work →", "Book a call →")
2. **Service section — UGC Content** (navy panel) — headline, pitch copy, proof card linking to the UGC portfolio (`seanjevangelista-pixel.github.io/seanjayme`, already wired into the current About section)
3. **Service section — Ads** (black panel) — headline, pitch copy, proof card referencing the Mediterranean Spa Google Ads case study. **Caveat: that account was suspended for "Unacceptable business practices: Phishing" in Aug 2026 — confirm it's active and healthy again before publishing real metrics/claims tied to it. If unresolved, use capability/process framing instead of a results claim.**
4. **Service section — Websites** (navy panel) — headline, pitch copy, proof card linking to the live Legacy Hardscape ATX site as a build example
5. **About** — reuse existing section (photo, bio, tags, UGC link) largely as-is, restyled to the new palette/type
6. **Contact** — reuse existing form as-is, restyled. Remove the `svc-pick` service-picker buttons (AI Front Desk / Marketing / Distribution) entirely — the existing free-text "What do you need?" message field already captures which service someone wants, so no replacement picker is needed
7. **Footer** — simplified; remove any Distribution/AI Front Desk links

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

| Pillar | Proof |
|---|---|
| UGC Content | Link to `seanjevangelista-pixel.github.io/seanjayme` |
| Ads | Mediterranean Spa Google Ads results (pending account-health confirmation — see caveat above) |
| Websites | Live link to Legacy Hardscape ATX site |

## Out of Scope / Follow-ups

- Deciding the actual fate of AI Front Desk and Distribution as product lines (keep running quietly vs. formal sunset) — separate conversation
- Confirming Mediterranean Spa's Google Ads account is unsuspended before publishing specific metrics
- Any changes to `dashboard/index.html`, `portal/index.html`, or backend API files
