-- Fix 1: anonymous visitors can't load facts because RLS calls is_adult_verified
GRANT EXECUTE ON FUNCTION public.is_adult_verified(uuid) TO anon;

-- Fix 2: leaderboard hid users with 0 points; show everyone (opt-in still respected)
CREATE OR REPLACE VIEW public.leaderboard_global
WITH (security_invoker = on) AS
SELECT us.user_id,
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
WHERE COALESCE(p.leaderboard_opt_out, false) = false
  AND COALESCE(p.hide_from_public, false) = false
ORDER BY COALESCE(us.total_points, 0) DESC NULLS LAST;

GRANT SELECT ON public.leaderboard_global TO anon, authenticated;
GRANT ALL ON public.leaderboard_global TO service_role;