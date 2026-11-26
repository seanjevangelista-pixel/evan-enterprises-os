-- Social post analytics synced from Buffer (api/integrations.js?action=buffer&sub=sync).
-- Run once in the Supabase SQL editor. RLS is on with no policies, so only the service key
-- (server-side) can read or write — the dashboard reads it through /api/integrations.
CREATE TABLE IF NOT EXISTS social_posts (
  buffer_post_id     text PRIMARY KEY,
  channel_id         text NOT NULL,
  service            text NOT NULL,              -- instagram, facebook, tiktok, youtube, linkedin, ...
  text               text,
  sent_at            timestamptz,
  external_link      text,
  views              numeric,
  impressions        numeric,
  reach              numeric,
  reactions          numeric,
  comments           numeric,
  shares             numeric,
  saves              numeric,
  engagement_rate    numeric,                    -- percent, 0-100
  metrics            jsonb NOT NULL DEFAULT '[]', -- full Buffer metric list, for anything not promoted above
  metrics_updated_at timestamptz,                -- Buffer refreshes metrics about once a day
  synced_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_posts_sent ON social_posts (sent_at DESC);
CREATE INDEX IF NOT EXISTS social_posts_service ON social_posts (service, sent_at DESC);
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON TABLE public.social_posts TO service_role;

-- Views per network, last 30 days:
-- SELECT service, count(*) posts, sum(views) views, round(avg(engagement_rate),2) avg_er
-- FROM social_posts WHERE sent_at > now() - interval '30 days' GROUP BY service ORDER BY 3 DESC NULLS LAST;
