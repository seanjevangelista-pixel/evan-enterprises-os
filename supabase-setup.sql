-- ============================================================
-- EVAN ENTERPRISES — Supabase Setup
-- Run this in the Supabase SQL editor (supabase.com → SQL Editor)
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT DO NOTHING
-- ============================================================


-- ── DISTRIBUTION LEADS ────────────────────────────────────────
-- Products you add each month for subscribers to flip on Amazon/Walmart

CREATE TABLE IF NOT EXISTS distribution_leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz DEFAULT now(),
  title         text NOT NULL,
  description   text,
  platform      text DEFAULT 'Amazon',  -- Amazon | Walmart | eBay
  category      text,
  image_url     text,
  buy_price     numeric(10,2) NOT NULL,
  sell_price    numeric(10,2) NOT NULL,
  monthly_sales integer,
  competition   text DEFAULT 'Medium',  -- Low | Medium | High
  status        text DEFAULT 'active'   -- active | archived
);

-- Enable RLS (row-level security)
ALTER TABLE distribution_leads ENABLE ROW LEVEL SECURITY;

-- Anyone can read active leads (gating is handled in the API)
CREATE POLICY "Public can read active leads"
  ON distribution_leads FOR SELECT
  USING (status = 'active');

-- Only service role can insert/update/delete (used by API with service key)
CREATE POLICY "Service role full access"
  ON distribution_leads FOR ALL
  USING (auth.role() = 'service_role');


-- ── DISTRIBUTION SUBSCRIBERS ──────────────────────────────────
-- People who pay $99/mo and get access to leads

CREATE TABLE IF NOT EXISTS distribution_subscribers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz DEFAULT now(),
  name              text NOT NULL,
  email             text NOT NULL UNIQUE,
  status            text DEFAULT 'active',       -- active | paused | cancelled
  plan_price        numeric(10,2) DEFAULT 99.00,
  access_token      text DEFAULT encode(gen_random_bytes(24), 'hex') UNIQUE,
  next_billing_date date,
  stripe_customer_id text,
  notes             text
);

ALTER TABLE distribution_subscribers ENABLE ROW LEVEL SECURITY;

-- Only service role reads subscribers (verify endpoint uses service key)
CREATE POLICY "Service role full access"
  ON distribution_subscribers FOR ALL
  USING (auth.role() = 'service_role');


-- ── CLIENTS ───────────────────────────────────────────────────
-- Marketing management clients (get portal access)

CREATE TABLE IF NOT EXISTS clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz DEFAULT now(),
  business_name   text NOT NULL,
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  -- Services being managed (toggle on/off per client)
  has_google_ads  boolean DEFAULT false,
  has_lsa         boolean DEFAULT false,
  has_facebook    boolean DEFAULT false,
  has_instagram   boolean DEFAULT false,
  has_reporting   boolean DEFAULT true,
  has_jobber      boolean DEFAULT false,
  has_seo         boolean DEFAULT false,
  has_social      boolean DEFAULT false,
  -- Billing
  monthly_fee     numeric(10,2),
  stripe_customer_id text,
  notes           text
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Clients can only read their own record (matched via users table)
CREATE POLICY "Clients read own record"
  ON clients FOR SELECT
  USING (
    id IN (
      SELECT client_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role full access"
  ON clients FOR ALL
  USING (auth.role() = 'service_role');


-- ── USERS (portal login link) ─────────────────────────────────
-- Maps Supabase auth users → client records
-- When you create a portal login for a client in Supabase Auth,
-- insert a row here linking their auth user ID to their client ID.

CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  client_id   uuid REFERENCES clients(id) ON DELETE SET NULL,
  role        text DEFAULT 'client'  -- client | admin
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own row
CREATE POLICY "Users read own row"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Service role full access"
  ON users FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-insert into users when a new Supabase Auth user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ── LSA LEADS ─────────────────────────────────────────────────
-- Leads from Google Local Service Ads (parsed via webhook)

CREATE TABLE IF NOT EXISTS lsa_leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz DEFAULT now(),
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  customer_name   text,
  customer_phone  text,
  customer_email  text,
  lead_type       text,   -- e.g. 'Phone call', 'Message'
  job_type        text,
  notes           text,
  status          text DEFAULT 'new'  -- new | contacted | booked | lost
);

ALTER TABLE lsa_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients read own leads"
  ON lsa_leads FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role full access"
  ON lsa_leads FOR ALL
  USING (auth.role() = 'service_role');


-- ── CALL LEADS ────────────────────────────────────────────────
-- Website call conversions tracked via Google Ads

CREATE TABLE IF NOT EXISTS call_leads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tapped_at   timestamptz DEFAULT now(),
  client_id   uuid REFERENCES clients(id) ON DELETE CASCADE,
  source      text,   -- 'google_ads' | 'organic' | 'direct'
  campaign    text,
  phone       text,
  notes       text
);

ALTER TABLE call_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients read own call leads"
  ON call_leads FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role full access"
  ON call_leads FOR ALL
  USING (auth.role() = 'service_role');


-- ── INVOICES ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz DEFAULT now(),
  client_id   uuid REFERENCES clients(id) ON DELETE CASCADE,
  title       text NOT NULL,
  amount      numeric(10,2) NOT NULL,
  due_date    date,
  paid_date   date,
  status      text DEFAULT 'unpaid',  -- unpaid | paid | overdue
  stripe_invoice_id text,
  notes       text
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients read own invoices"
  ON invoices FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Service role full access"
  ON invoices FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================
-- DONE. Next steps:
-- 1. Add a client: INSERT INTO clients (business_name, ...) VALUES (...)
-- 2. Create portal login in Supabase Auth → Authentication → Users
-- 3. Link login to client: UPDATE users SET client_id = '<client_uuid>' WHERE id = '<user_uuid>'
-- 4. Add a subscriber: INSERT INTO distribution_subscribers (name, email) VALUES (...)
-- 5. Add leads: INSERT INTO distribution_leads (title, buy_price, sell_price, ...) VALUES (...)
-- ============================================================
