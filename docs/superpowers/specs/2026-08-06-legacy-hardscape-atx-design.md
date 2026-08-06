# Legacy Hardscape ATX — marketing website design

## Context

New client: Legacy Hardscape ATX, a hardscaping/outdoor-living contractor in Austin, TX. Sean wants a marketing website built for them as part of the same "manage ads + build website + deploy AI bot" bundle already proven with Mediterranean Spa. No existing branding (no logo/color palette), but the client provided real project photos covering most of their service lines — a strong asset most new-client sites don't start with.

## Decisions

- **Location**: new folder in this repo, `legacy-hardscape/`, deployed alongside `/demo`, `/dashboard`, etc. (not a separate project).
- **Structure**: single-page site (Option A) — no multi-page split for launch.
- **Services** (11, grouped into 3 categories for the Services section):
  - Hardscape: Driveways, Patios, Walkways, Stained Concrete
  - Outdoor Living: Pergolas, Outdoor Kitchens, Fire Pits
  - Landscape: Turf Installation, Sod Installation, Plant Installation, Tree Removal
  - No dedicated photos exist yet for Stained Concrete, Sod Installation, or Tree Removal — these launch as text-only listings.
- **Conversion goal**: free quote/estimate form is the primary CTA (not phone-first).
- **Lead routing**: form submissions go to `legacyhardscapeatx@gmail.com`.
- **Photos**: real project photos (not stock), sourced from client-provided PicCollage exports, split into 39 individual images via a one-off Python/Pillow script, saved to `legacy-hardscape/img/raw-source/`. 6 of those files still have a "PIC•COLLAGE" watermark baked into one corner (`IMG_1394_cell6`, `IMG_1395_row3_3`, `IMG_1396_cell4`, `IMG_1397_cell6`, `IMG_1398_cell6`, `IMG_1399_cell6`) — crop further or exclude from the final gallery during build.
- **Chatbot**: yes, wire up Agent 4 via the `bot_profiles` table (same system built for the `/demo` page) — new profile row for Legacy Hardscape ATX, chat widget embedded same as `/demo`.
- **Design system**: not reusing Evan Enterprises' own "Dispatch" chrome/monochrome identity (that's Sean's brand, not the client's). New palette to be drawn from the real photos — warm stone/wood tones — decided during build rather than upfront, per the "work on it as we go" direction.

## Page structure (single page, `legacy-hardscape/index.html`)

1. Nav — logo/wordmark, anchor links (Services / Gallery / Contact), sticky, phone number visible
2. Hero — full-width real project photo, headline, subhead, "Get a Free Quote" CTA
3. Services — 3 category groups as listed above, photo where available
4. Gallery — grid of real project photos (minus/cropped watermarked ones)
5. Quote form — name, phone, email, project type (dropdown of the 11 services), message → emails `legacyhardscapeatx@gmail.com`
6. Chat widget — same pattern as `/demo`, new `bot_profiles` row
7. Footer — service area (Austin, TX), contact info

## Build approach

Iterative — build and review section by section in the browser rather than fully speccing visual design details (palette, exact copy, form backend wiring) in text upfront, per Sean's preference to keep moving. This doc captures the structural/content decisions that are settled; visual and implementation details are worked out live during the build.

## Verification

Preview each section in the Browser pane as it's built (matches this repo's `<when_to_verify>` convention — no build step, static HTML). Confirm the quote form actually delivers to `legacyhardscapeatx@gmail.com` before considering the site launch-ready. Confirm the chatbot responds with Legacy Hardscape ATX content, not Evan Enterprises' or the demo plumbing profile's.
