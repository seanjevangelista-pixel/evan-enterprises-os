-- ============================================================
-- RLS PATCH — Run this AFTER schema.sql
-- Replaces JWT-claim policies with auth.uid() + users table lookup.
-- This works with the anon key + Supabase Auth (email/password).
-- ============================================================

-- 1. Enable RLS on users table
alter table users enable row level security;

-- Users can read their own record (required for admin role check)
create policy "user_read_own" on users for select
  using (id = auth.uid());

-- 2. Drop old JWT-based policies
drop policy if exists "admin_all_clients"   on clients;
drop policy if exists "admin_all_visits"    on visits;
drop policy if exists "admin_all_summaries" on monthly_summaries;
drop policy if exists "admin_all_pipeline"  on pipeline_notes;
drop policy if exists "admin_all_tasks"     on tasks;
drop policy if exists "admin_all_cache"     on api_cache;

-- 3. Admin policies: look up role from users table
create policy "admin_all_clients" on clients for all
  using      ((select role from users where id = auth.uid()) = 'admin')
  with check ((select role from users where id = auth.uid()) = 'admin');

create policy "admin_all_visits" on visits for all
  using      ((select role from users where id = auth.uid()) = 'admin')
  with check ((select role from users where id = auth.uid()) = 'admin');

create policy "admin_all_summaries" on monthly_summaries for all
  using      ((select role from users where id = auth.uid()) = 'admin')
  with check ((select role from users where id = auth.uid()) = 'admin');

create policy "admin_all_pipeline" on pipeline_notes for all
  using      ((select role from users where id = auth.uid()) = 'admin')
  with check ((select role from users where id = auth.uid()) = 'admin');

create policy "admin_all_tasks" on tasks for all
  using      ((select role from users where id = auth.uid()) = 'admin')
  with check ((select role from users where id = auth.uid()) = 'admin');

create policy "admin_all_cache" on api_cache for all
  using      ((select role from users where id = auth.uid()) = 'admin')
  with check ((select role from users where id = auth.uid()) = 'admin');

-- 4. Client portal policies (read-only, own data)
drop policy if exists "client_own_data"    on clients;
drop policy if exists "client_own_visits"  on visits;
drop policy if exists "client_own_summary" on monthly_summaries;

create policy "client_own_data" on clients for select
  using (id = (select client_id from users where id = auth.uid()));

create policy "client_own_visits" on visits for select
  using (client_id = (select client_id from users where id = auth.uid()));

create policy "client_own_summary" on monthly_summaries for select
  using (client_id = (select client_id from users where id = auth.uid()));
