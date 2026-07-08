
-- Profile additions for age/category segmentation + privacy
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_band TEXT CHECK (age_band IN ('under_10','10_12','teen','adult')),
  ADD COLUMN IF NOT EXISTS favorite_category TEXT,
  ADD COLUMN IF NOT EXISTS leaderboard_opt_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_from_public BOOLEAN NOT NULL DEFAULT false;

-- Append-only XP ledger powering time-window / category / activity views
CREATE TABLE IF NOT EXISTS public.xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('quiz','discovery','daily','streak','achievement','login','mission')),
  points INT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own xp events read" ON public.xp_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own xp events insert" ON public.xp_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS xp_events_user_created_idx ON public.xp_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS xp_events_created_idx      ON public.xp_events (created_at DESC);
CREATE INDEX IF NOT EXISTS xp_events_category_idx     ON public.xp_events (category) WHERE category IS NOT NULL;

-- ============ Views ============
-- Base "eligible participant" filter shared by all views.
-- Uses security_invoker so RLS on profiles/user_stats applies to caller.

-- Unified global leaderboard (by total XP, single source of truth)
DROP VIEW IF EXISTS public.leaderboard_global;
CREATE VIEW public.leaderboard_global
WITH (security_invoker = true) AS
SELECT
  us.user_id,
  p.username,
  p.display_name,
  p.avatar_id,
  p.age_band,
  p.favorite_category,
  COALESCE(us.total_points, 0) AS score,
  us.current_streak,
  us.longest_streak,
  us.facts_seen
FROM public.user_stats us
LEFT JOIN public.profiles p ON p.id = us.user_id
WHERE COALESCE(us.total_points, 0) > 0
  AND COALESCE(p.leaderboard_opt_out, false) = false
ORDER BY us.total_points DESC NULLS LAST;
GRANT SELECT ON public.leaderboard_global TO authenticated;

-- Time-windowed leaderboard (sum XP events over a rolling window)
DROP VIEW IF EXISTS public.leaderboard_windowed;
CREATE VIEW public.leaderboard_windowed
WITH (security_invoker = true) AS
SELECT
  e.user_id,
  p.username,
  p.display_name,
  p.avatar_id,
  p.age_band,
  p.favorite_category,
  SUM(e.points)::int AS score,
  e.created_at
FROM public.xp_events e
LEFT JOIN public.profiles p ON p.id = e.user_id
WHERE COALESCE(p.leaderboard_opt_out, false) = false
GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category, e.created_at;
GRANT SELECT ON public.leaderboard_windowed TO authenticated;

-- Category leaderboard (sum XP events per category)
DROP VIEW IF EXISTS public.leaderboard_category;
CREATE VIEW public.leaderboard_category
WITH (security_invoker = true) AS
SELECT
  e.user_id,
  e.category,
  p.username,
  p.display_name,
  p.avatar_id,
  p.age_band,
  SUM(e.points)::int AS score
FROM public.xp_events e
LEFT JOIN public.profiles p ON p.id = e.user_id
WHERE e.category IS NOT NULL
  AND COALESCE(p.leaderboard_opt_out, false) = false
GROUP BY e.user_id, e.category, p.username, p.display_name, p.avatar_id, p.age_band;
GRANT SELECT ON public.leaderboard_category TO authenticated;

-- Rising Stars: biggest 7-day XP delta
DROP VIEW IF EXISTS public.leaderboard_rising;
CREATE VIEW public.leaderboard_rising
WITH (security_invoker = true) AS
SELECT
  e.user_id,
  p.username,
  p.display_name,
  p.avatar_id,
  p.age_band,
  p.favorite_category,
  SUM(e.points)::int AS score
FROM public.xp_events e
LEFT JOIN public.profiles p ON p.id = e.user_id
WHERE e.created_at >= now() - interval '7 days'
  AND COALESCE(p.leaderboard_opt_out, false) = false
GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category;
GRANT SELECT ON public.leaderboard_rising TO authenticated;

-- Streak Champions
DROP VIEW IF EXISTS public.leaderboard_streaks;
CREATE VIEW public.leaderboard_streaks
WITH (security_invoker = true) AS
SELECT
  us.user_id,
  p.username,
  p.display_name,
  p.avatar_id,
  p.age_band,
  p.favorite_category,
  us.current_streak AS score,
  us.longest_streak
FROM public.user_stats us
LEFT JOIN public.profiles p ON p.id = us.user_id
WHERE us.current_streak > 0
  AND COALESCE(p.leaderboard_opt_out, false) = false;
GRANT SELECT ON public.leaderboard_streaks TO authenticated;

-- Weekend Warriors: XP earned on Sat/Sun in last 30 days
DROP VIEW IF EXISTS public.leaderboard_weekend;
CREATE VIEW public.leaderboard_weekend
WITH (security_invoker = true) AS
SELECT
  e.user_id,
  p.username,
  p.display_name,
  p.avatar_id,
  p.age_band,
  p.favorite_category,
  SUM(e.points)::int AS score
FROM public.xp_events e
LEFT JOIN public.profiles p ON p.id = e.user_id
WHERE e.created_at >= now() - interval '30 days'
  AND EXTRACT(ISODOW FROM e.created_at) IN (6, 7)
  AND COALESCE(p.leaderboard_opt_out, false) = false
GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category;
GRANT SELECT ON public.leaderboard_weekend TO authenticated;

-- New Explorers: joined in last 14 days
DROP VIEW IF EXISTS public.leaderboard_new;
CREATE VIEW public.leaderboard_new
WITH (security_invoker = true) AS
SELECT
  us.user_id,
  p.username,
  p.display_name,
  p.avatar_id,
  p.age_band,
  p.favorite_category,
  COALESCE(us.total_points, 0) AS score,
  p.created_at AS joined_at
FROM public.user_stats us
LEFT JOIN public.profiles p ON p.id = us.user_id
WHERE p.created_at >= now() - interval '14 days'
  AND COALESCE(p.leaderboard_opt_out, false) = false;
GRANT SELECT ON public.leaderboard_new TO authenticated;

-- New leaderboard-based achievements
INSERT INTO public.achievements (id, name, description, emoji, category, threshold, sort_order)
VALUES
  ('top_100_global',     'Top 100 Explorer',    'Reach the top 100 of the global leaderboard', '🌍', 'leaderboard', 100, 300),
  ('top_10_category',    'Category Champion',   'Reach the top 10 of any category leaderboard', '🏆', 'leaderboard',  10, 301),
  ('rising_star_top_10', 'Rising Star',         'Enter the top 10 Rising Stars this week',      '🚀', 'leaderboard',  10, 302)
ON CONFLICT (id) DO NOTHING;
