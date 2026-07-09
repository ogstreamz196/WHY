
-- Recreate leaderboard views as SECURITY DEFINER so anon/authenticated
-- callers can read the aggregated public leaderboard without needing direct
-- access to profiles / user_stats / xp_events / quiz_sessions. Only safe
-- public columns are exposed.

DROP VIEW IF EXISTS public.leaderboard_global CASCADE;
DROP VIEW IF EXISTS public.leaderboard_category CASCADE;
DROP VIEW IF EXISTS public.leaderboard_windowed CASCADE;
DROP VIEW IF EXISTS public.leaderboard_rising CASCADE;
DROP VIEW IF EXISTS public.leaderboard_streaks CASCADE;
DROP VIEW IF EXISTS public.leaderboard_weekend CASCADE;
DROP VIEW IF EXISTS public.leaderboard_new CASCADE;
DROP VIEW IF EXISTS public.leaderboard_weekly CASCADE;

CREATE VIEW public.leaderboard_global AS
SELECT us.user_id,
       p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category,
       COALESCE(us.total_points, 0) AS score,
       us.current_streak, us.longest_streak, us.facts_seen
  FROM public.user_stats us
  LEFT JOIN public.profiles p ON p.id = us.user_id
 WHERE COALESCE(us.total_points, 0) > 0
   AND COALESCE(p.leaderboard_opt_out, false) = false
   AND COALESCE(p.hide_from_public, false) = false
 ORDER BY us.total_points DESC NULLS LAST;

CREATE VIEW public.leaderboard_category AS
SELECT e.user_id, e.category,
       p.username, p.display_name, p.avatar_id, p.age_band,
       (sum(e.points))::integer AS score
  FROM public.xp_events e
  LEFT JOIN public.profiles p ON p.id = e.user_id
 WHERE e.category IS NOT NULL
   AND COALESCE(p.leaderboard_opt_out, false) = false
   AND COALESCE(p.hide_from_public, false) = false
 GROUP BY e.user_id, e.category, p.username, p.display_name, p.avatar_id, p.age_band;

CREATE VIEW public.leaderboard_windowed AS
SELECT e.user_id,
       p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category,
       (sum(e.points))::integer AS score,
       e.created_at
  FROM public.xp_events e
  LEFT JOIN public.profiles p ON p.id = e.user_id
 WHERE COALESCE(p.leaderboard_opt_out, false) = false
   AND COALESCE(p.hide_from_public, false) = false
 GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category, e.created_at;

CREATE VIEW public.leaderboard_rising AS
SELECT e.user_id,
       p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category,
       (sum(e.points))::integer AS score
  FROM public.xp_events e
  LEFT JOIN public.profiles p ON p.id = e.user_id
 WHERE e.created_at >= now() - interval '7 days'
   AND COALESCE(p.leaderboard_opt_out, false) = false
   AND COALESCE(p.hide_from_public, false) = false
 GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category;

CREATE VIEW public.leaderboard_streaks AS
SELECT us.user_id,
       p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category,
       us.current_streak AS score,
       us.longest_streak
  FROM public.user_stats us
  LEFT JOIN public.profiles p ON p.id = us.user_id
 WHERE us.current_streak > 0
   AND COALESCE(p.leaderboard_opt_out, false) = false
   AND COALESCE(p.hide_from_public, false) = false;

CREATE VIEW public.leaderboard_weekend AS
SELECT e.user_id,
       p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category,
       (sum(e.points))::integer AS score
  FROM public.xp_events e
  LEFT JOIN public.profiles p ON p.id = e.user_id
 WHERE e.created_at >= now() - interval '30 days'
   AND EXTRACT(isodow FROM e.created_at) IN (6, 7)
   AND COALESCE(p.leaderboard_opt_out, false) = false
   AND COALESCE(p.hide_from_public, false) = false
 GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category;

CREATE VIEW public.leaderboard_new AS
SELECT us.user_id,
       p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category,
       COALESCE(us.total_points, 0) AS score,
       p.created_at AS joined_at
  FROM public.user_stats us
  LEFT JOIN public.profiles p ON p.id = us.user_id
 WHERE p.created_at >= now() - interval '14 days'
   AND COALESCE(p.leaderboard_opt_out, false) = false
   AND COALESCE(p.hide_from_public, false) = false;

CREATE VIEW public.leaderboard_weekly AS
SELECT s.user_id,
       p.username, p.display_name, p.avatar_id,
       (sum(s.score))::integer AS week_score,
       (count(*))::integer AS quizzes_played,
       max(s.score) AS best_this_week
  FROM public.quiz_sessions s
  LEFT JOIN public.profiles p ON p.id = s.user_id
 WHERE s.finished_at >= date_trunc('week', now())
   AND COALESCE(p.leaderboard_opt_out, false) = false
   AND COALESCE(p.hide_from_public, false) = false
 GROUP BY s.user_id, p.username, p.display_name, p.avatar_id
 ORDER BY (sum(s.score))::integer DESC;

-- Views are owned by postgres (superuser) and default to SECURITY DEFINER
-- semantics, which is what we want: callers read only these curated columns
-- via the view, never the underlying tables. Grant read to anon + authenticated.
GRANT SELECT ON public.leaderboard_global      TO anon, authenticated;
GRANT SELECT ON public.leaderboard_category    TO anon, authenticated;
GRANT SELECT ON public.leaderboard_windowed    TO anon, authenticated;
GRANT SELECT ON public.leaderboard_rising      TO anon, authenticated;
GRANT SELECT ON public.leaderboard_streaks     TO anon, authenticated;
GRANT SELECT ON public.leaderboard_weekend     TO anon, authenticated;
GRANT SELECT ON public.leaderboard_new         TO anon, authenticated;
GRANT SELECT ON public.leaderboard_weekly      TO anon, authenticated;
