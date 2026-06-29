-- ============================================================
-- EVAN ENTERPRISES LLC — BUSINESS OS DATABASE SCHEMA
-- Supabase / PostgreSQL
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS (admin + client logins)
-- ============================================================
create table if not exists users (
  id            uuid primary key default uuid_generate_v4(),
  email         text unique not null,
  role          text not null check (role in ('admin', 'client')),
  client_id     uuid,                          -- null for admin; FK set after clients table created
  created_at    timestamptz default now()
);

-- ============================================================
-- CLIENTS (one row per business we serve)
-- ============================================================
create table if not exists clients (
  id                  uuid primary key default uuid_generate_v4(),
  business_name       text not null,
  owner_name          text,
  owner_email         text,
  owner_phone         text,
  city                text,
  state               text,
  status              text not null default 'prospect'
                        check (status in ('prospect','call_booked','call_happened','active','lost')),
  division            text not null default 'marketing'
                        check (division in ('marketing','distribution','ecommerce')),

  -- Contract terms
  monthly_flat_fee    numeric(10,2) default 500.00,
  performance_pct     numeric(5,4)  default 0.10,    -- stored as decimal: 0.10 = 10%

  -- LSA / ad budget (ad spend ALWAYS on client card — never mine)
  lsa_weekly_budget   numeric(10,2),
  lsa_monthly_budget  numeric(10,2),
  avg_ticket          numeric(10,2),

  -- Review tracking
  google_review_count integer default 0,

  -- Square billing
  square_customer_id  text,
  square_subscription_id text,

  -- AgencyAnalytics
  agency_analytics_id text,

  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Add FK from users → clients
alter table users
  add constraint fk_users_client
  foreign key (client_id) references clients(id) on delete set null;

-- ============================================================
-- CLIENT VISITS / REVENUE RECORDS
-- Each row = one client visit at the business we serve.
-- This is the source of truth for the 10% performance fee.
-- ============================================================
create table if not exists visits (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references clients(id) on delete cascade,

  -- End-customer info (for retained-client detection)
  customer_name   text not null,
  customer_phone  text,
  customer_email  text,

  visit_date      date not null,
  service         text,
  amount          numeric(10,2) not null,
  source          text check (source in (
                    'lsa','google_ads','instagram','referral','walk_in','other'
                  )),

  -- Computed fields (set by trigger or application)
  visit_number    integer,           -- 1 = first visit, 2+ = return
  is_retained     boolean default false,  -- true if name+phone+email matched a prior visit
  first_visit_id  uuid references visits(id),  -- points to the original visit record

  -- Walk-in override: walk-ins don't count toward 10% unless manually overridden
  count_for_fee   boolean default true,

  -- My fee on this visit
  fee_pct         numeric(5,4) default 0.10,
  fee_amount      numeric(10,2),     -- computed: amount * fee_pct (when count_for_fee = true)

  notes           text,
  created_at      timestamptz default now()
);

-- ============================================================
-- RETAINED CLIENT DETECTION TRIGGER
-- On insert: check if (customer_name + customer_phone + customer_email)
-- exists for ANY prior visit for the same client.
-- If yes → is_retained = true, first_visit_id = earliest match.
-- Walk-ins are excluded from the fee by default.
-- ============================================================
create or replace function fn_detect_retained_visit()
returns trigger language plpgsql as $$
declare
  v_prior visits%rowtype;
begin
  -- Find earliest matching visit for this client with same name+phone+email
  select * into v_prior
  from visits
  where client_id       = new.client_id
    and lower(trim(customer_name))  = lower(trim(new.customer_name))
    and lower(trim(customer_phone)) = lower(trim(new.customer_phone))
    and lower(trim(customer_email)) = lower(trim(new.customer_email))
    and id != new.id
  order by visit_date asc
  limit 1;

  if found then
    new.is_retained     := true;
    new.first_visit_id  := coalesce(v_prior.first_visit_id, v_prior.id);
    -- Inherited visit number
    new.visit_number    := (
      select count(*) + 1
      from visits
      where client_id       = new.client_id
        and lower(trim(customer_name))  = lower(trim(new.customer_name))
        and lower(trim(customer_phone)) = lower(trim(new.customer_phone))
        and lower(trim(customer_email)) = lower(trim(new.customer_email))
    );
  else
    new.is_retained    := false;
    new.visit_number   := 1;
    new.first_visit_id := null;
  end if;

  -- Walk-ins don't count toward fee unless overridden
  if new.source = 'walk_in' and new.count_for_fee is distinct from true then
    new.count_for_fee := false;
  end if;

  -- Compute fee amount
  if new.count_for_fee then
    new.fee_amount := round(new.amount * new.fee_pct, 2);
  else
    new.fee_amount := 0;
  end if;

  return new;
end;
$$;

create trigger trg_detect_retained_visit
  before insert on visits
  for each row execute function fn_detect_retained_visit();

-- ============================================================
-- MONTHLY SUMMARIES (cached per client per month)
-- Regenerated by app on demand or scheduled function.
-- ============================================================
create table if not exists monthly_summaries (
  id                  uuid primary key default uuid_generate_v4(),
  client_id           uuid not null references clients(id) on delete cascade,
  year                integer not null,
  month               integer not null check (month between 1 and 12),

  total_visits        integer default 0,
  new_visits          integer default 0,
  retained_visits     integer default 0,
  total_revenue       numeric(10,2) default 0,
  billable_revenue    numeric(10,2) default 0,  -- revenue where count_for_fee = true
  flat_fee            numeric(10,2) default 500,
  performance_fee     numeric(10,2) default 0,  -- 10% of billable_revenue
  total_owed_to_me    numeric(10,2) default 0,  -- flat_fee + performance_fee

  -- Square invoice status
  invoice_id          text,
  invoice_status      text default 'pending' check (invoice_status in ('pending','sent','paid','overdue')),
  invoice_sent_at     timestamptz,
  paid_at             timestamptz,

  report_sent_at      timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),

  unique(client_id, year, month)
);

-- ============================================================
-- PIPELINE STAGES (CRM)
-- ============================================================
create table if not exists pipeline_notes (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid not null references clients(id) on delete cascade,
  stage       text not null,
  note        text,
  created_by  uuid references users(id),
  created_at  timestamptz default now()
);

-- ============================================================
-- TASKS
-- ============================================================
create table if not exists tasks (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid references clients(id) on delete cascade,
  title        text not null,
  description  text,
  due_date     date,
  priority     text default 'medium' check (priority in ('low','medium','high')),
  status       text default 'open' check (status in ('open','in_progress','done')),
  assigned_to  uuid references users(id),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================================
-- API INTEGRATION CACHE
-- Stores latest pulled data from AgencyAnalytics / Google Ads / LSA
-- ============================================================
create table if not exists api_cache (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid not null references clients(id) on delete cascade,
  source      text not null check (source in ('agency_analytics','google_ads','google_lsa','square')),
  payload     jsonb,
  pulled_at   timestamptz default now(),
  unique(client_id, source)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table clients         enable row level security;
alter table visits          enable row level security;
alter table monthly_summaries enable row level security;
alter table pipeline_notes  enable row level security;
alter table tasks           enable row level security;
alter table api_cache       enable row level security;

-- Admin sees everything
create policy "admin_all_clients"           on clients           for all using (auth.jwt() ->> 'role' = 'admin');
create policy "admin_all_visits"            on visits            for all using (auth.jwt() ->> 'role' = 'admin');
create policy "admin_all_summaries"         on monthly_summaries for all using (auth.jwt() ->> 'role' = 'admin');
create policy "admin_all_pipeline"          on pipeline_notes    for all using (auth.jwt() ->> 'role' = 'admin');
create policy "admin_all_tasks"             on tasks             for all using (auth.jwt() ->> 'role' = 'admin');
create policy "admin_all_cache"             on api_cache         for all using (auth.jwt() ->> 'role' = 'admin');

-- Clients see only their own data (read-only)
create policy "client_own_data"   on clients           for select using (
  id = (select client_id from users where id = auth.uid())
);
create policy "client_own_visits" on visits            for select using (
  client_id = (select client_id from users where id = auth.uid())
);
create policy "client_own_summary" on monthly_summaries for select using (
  client_id = (select client_id from users where id = auth.uid())
);

-- ============================================================
-- SEED: Insert Sean as admin
-- (Replace 'seanjevangelista@gmail.com' with actual Supabase auth user)
-- ============================================================
-- insert into users (email, role) values ('seanjevangelista@gmail.com', 'admin');

-- ============================================================
-- SEED: Mediterranean Spa (first active client)
-- ============================================================
-- insert into clients (
--   business_name, owner_name, owner_email, city, state,
--   status, division, monthly_flat_fee, performance_pct,
--   lsa_weekly_budget, lsa_monthly_budget, avg_ticket, google_review_count
-- ) values (
--   'Mediterranean Spa', 'Salma Moreno', null,
--   'Baltimore', 'MD', 'active', 'marketing',
--   500.00, 0.10, 102.00, 443.00, 150.00, 216
-- );
