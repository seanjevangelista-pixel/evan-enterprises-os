-- ============================================================
-- EVAN ENTERPRISES — Bot Profiles
-- Run this in the Supabase SQL editor (supabase.com → SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT DO NOTHING
--
-- Powers the multi-tenant chatbot (Agent 4, api/agent.js?action=chat).
-- One row per business the bot can speak for — real clients (via
-- client_id) or standalone demo businesses (is_demo = true).
-- ============================================================

CREATE TABLE IF NOT EXISTS bot_profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz DEFAULT now(),
  slug          text NOT NULL UNIQUE,
  client_id     uuid REFERENCES clients(id) ON DELETE SET NULL,  -- null for demo-only profiles
  business_name text NOT NULL,
  industry      text,
  services      jsonb DEFAULT '[]',   -- [{"name":"...", "desc":"..."}]
  pricing       text,                 -- optional freeform pricing blurb
  key_facts     text,                 -- freeform bullet facts (hours, service area, licensing, etc.)
  tone          text DEFAULT 'concise, professional, and friendly',
  booking_link  text,
  contact_phone text,
  contact_email text,
  is_demo       boolean DEFAULT false,
  active        boolean DEFAULT true
);

ALTER TABLE bot_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read active profiles (the chat endpoint is public; gating,
-- if any, happens in the API layer)
CREATE POLICY "Public can read active bot profiles"
  ON bot_profiles FOR SELECT
  USING (active = true);

CREATE POLICY "Service role full access on bot profiles"
  ON bot_profiles FOR ALL
  USING (auth.role() = 'service_role');


-- ── SEED: Evan Enterprises fallback profile ────────────────────
-- This is what api/agent.js falls back to when no botSlug is passed,
-- so existing behavior is unchanged. Content mirrors the prompt that
-- used to be hardcoded directly in the file.
INSERT INTO bot_profiles (
  slug, business_name, industry, services, key_facts, tone, booking_link, is_demo
) VALUES (
  'evan-enterprises',
  'Evan Enterprises LLC',
  'marketing and distribution agency',
  '[
    {"name":"Starter","desc":"$500/mo + 10% — Google LSA, Google Business Profile, review automation, SMS reactivation, monthly reports"},
    {"name":"Growth","desc":"$900/mo + 10% — Everything in Starter + Google Ads, referral program, UGC content, Apple Maps, bi-weekly calls"},
    {"name":"Multi-location","desc":"$1,300/location — Google Ads per location, unified reporting, cross-location strategy"},
    {"name":"Distribution","desc":"Custom — Amazon/Walmart product sourcing and placement"}
  ]'::jsonb,
  E'Ad spend always goes on the client''s card, never ours\n10% performance fee applies to revenue from retained clients we bring in\nFree 30-minute strategy call to get started\nBook at: https://calendar.google.com (or tell them to email sean@evanenterprise.com)\nCurrent client: Mediterranean Spa, Baltimore MD — 34 leads in month 1 at $26.47 CPL',
  'concise, professional, and helpful',
  'https://calendar.google.com',
  false
) ON CONFLICT (slug) DO NOTHING;


-- ── SEED: Demo profile — Lone Star Plumbing & Drain ────────────
-- Fake generic local-service business for the /demo showcase page.
-- Replaces the third-party GoHighLevel widget demo with a real,
-- working example of Evan Enterprises' own bot.
INSERT INTO bot_profiles (
  slug, business_name, industry, services, pricing, key_facts, tone, booking_link, is_demo
) VALUES (
  'demo-plumbing',
  'Lone Star Plumbing & Drain',
  'residential plumbing company',
  '[
    {"name":"Drain Cleaning","desc":"Fast clog and slow-drain clearing for kitchens, bathrooms, and main lines"},
    {"name":"Water Heater Repair & Install","desc":"Tank and tankless, same-day diagnostics"},
    {"name":"Emergency Plumbing","desc":"Burst pipes, leaks, no-water calls — 24/7 dispatch"},
    {"name":"General Repairs","desc":"Faucets, toilets, garbage disposals, fixture installs"}
  ]'::jsonb,
  'Flat-rate diagnostic fee of $59, waived if you book the repair same-visit. Financing available on jobs over $500.',
  E'Licensed & insured\n24/7 emergency dispatch\nServes the greater metro area\nSame-day appointments usually available\nThis is a demo business used to showcase Evan Enterprises'' AI front-desk bot — not a real plumbing company',
  'warm, direct, and reassuring — like a dispatcher who actually picks up the phone',
  'https://calendar.google.com',
  true
) ON CONFLICT (slug) DO NOTHING;
