DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT id, display_name, username, avatar_id, bio, favorite_category, leaderboard_opt_out, created_at, updated_at
FROM public.profiles
WHERE hide_from_public = false;
GRANT SELECT ON public.profiles_public TO anon, authenticated;