-- Click log for tracked links (/go/:slug). Run once in the Supabase SQL editor.
-- RLS is on with no policies, so only the service key (server-side) can read or write.
CREATE TABLE IF NOT EXISTS link_clicks (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  slug       text NOT NULL,
  source     text,
  referrer   text,
  country    text
);
CREATE INDEX IF NOT EXISTS link_clicks_slug_time ON link_clicks (slug, clicked_at DESC);
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

-- Clicks per link, last 30 days:
-- SELECT slug, count(*) FROM link_clicks WHERE clicked_at > now() - interval '30 days' GROUP BY slug ORDER BY 2 DESC;

-- If the logs show "permission denied for table link_clicks" (error 42501), the server role is missing
-- table privileges. Run this once. (RLS stays on, so public/anon visitors still cannot read or write.)
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON TABLE public.link_clicks TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
