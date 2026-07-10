REVOKE ALL ON FUNCTION public.get_public_leaderboard(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_leaderboard(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_leaderboard(text, text) TO service_role;