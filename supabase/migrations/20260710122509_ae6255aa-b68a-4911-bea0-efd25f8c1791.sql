DROP VIEW IF EXISTS public.leaderboard_global;
CREATE VIEW public.leaderboard_global AS
SELECT
  p.id AS user_id,
  p.username,
  p.display_name,
  p.avatar_id,
  p.age_band,
  p.favorite_category,
  COALESCE(us.total_points, 0) AS score,
  COALESCE(us.current_streak, 0) AS current_streak,
  COALESCE(us.longest_streak, 0) AS longest_streak,
  COALESCE(us.facts_seen, 0) AS facts_seen
FROM public.profiles p
LEFT JOIN public.user_stats us ON us.user_id = p.id
WHERE COALESCE(p.leaderboard_opt_out, false) = false
  AND COALESCE(p.hide_from_public, false) = false
ORDER BY COALESCE(us.total_points, 0) DESC NULLS LAST;
GRANT SELECT ON public.leaderboard_global TO anon, authenticated;