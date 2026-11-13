-- Private finance page storage. Run once in the Supabase SQL editor.
-- Row level security is ON with no policies, so only the server (service key) can read or write it.
create table if not exists public.finance_private (
  id text primary key,
  html text not null,
  updated_at timestamptz not null default now()
);
alter table public.finance_private enable row level security;

-- Needed on projects that do not grant new tables to the server role automatically.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON TABLE public.finance_private TO service_role;
