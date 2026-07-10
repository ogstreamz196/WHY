
-- Convert all public leaderboard/profile views to SECURITY INVOKER so RLS applies as caller.
ALTER VIEW public.profiles_public SET (security_invoker = on);
ALTER VIEW public.leaderboard_global SET (security_invoker = on);
ALTER VIEW public.leaderboard_weekly SET (security_invoker = on);
ALTER VIEW public.leaderboard_rising SET (security_invoker = on);
ALTER VIEW public.leaderboard_streaks SET (security_invoker = on);
ALTER VIEW public.leaderboard_weekend SET (security_invoker = on);
ALTER VIEW public.leaderboard_category SET (security_invoker = on);
ALTER VIEW public.leaderboard_windowed SET (security_invoker = on);
ALTER VIEW public.leaderboard_new SET (security_invoker = on);

-- Public read policies on underlying tables to keep leaderboards working under invoker views.
DROP POLICY IF EXISTS "public profiles readable" ON public.profiles;
CREATE POLICY "public profiles readable" ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (COALESCE(hide_from_public, false) = false);

DROP POLICY IF EXISTS "public user_stats readable" ON public.user_stats;
CREATE POLICY "public user_stats readable" ON public.user_stats
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public quiz_sessions readable" ON public.quiz_sessions;
CREATE POLICY "public quiz_sessions readable" ON public.quiz_sessions
  FOR SELECT TO anon, authenticated
  USING (finished_at IS NOT NULL);

DROP POLICY IF EXISTS "public xp_events readable" ON public.xp_events;
CREATE POLICY "public xp_events readable" ON public.xp_events
  FOR SELECT TO anon, authenticated USING (true);

-- Protect sensitive columns on profiles at the column-privilege layer.
-- Adult verification fields must never be reachable via the Data API by anon or
-- other signed-in users; server code reads/writes them via the service role.
REVOKE SELECT (adult_verified_at, adult_provider) ON public.profiles FROM anon, authenticated;
REVOKE UPDATE (adult_verified_at, adult_provider) ON public.profiles FROM anon, authenticated;

-- Convert SECURITY DEFINER helpers to SECURITY INVOKER; they only read the
-- caller's own user_roles rows so INVOKER + RLS is safe and drops the linter
-- warning about executable definer functions.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_boss(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_uid, 'admin'::public.app_role)
$function$;

-- Allow authenticated users to read user_roles rows scoped to themselves so
-- the INVOKER has_role() above returns true for them (server code uses
-- service_role and bypasses this).
DROP POLICY IF EXISTS "user_roles self readable" ON public.user_roles;
CREATE POLICY "user_roles self readable" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- boss_decode_fact_code stays SECURITY DEFINER (needs to bypass RLS on facts)
-- but must NOT be callable by anon/authenticated blanket — enforce role check
-- in-function and restrict EXECUTE.
REVOKE EXECUTE ON FUNCTION public.boss_decode_fact_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.boss_decode_fact_code(text) TO service_role;

-- Lock down categories & achievements to signed-in users only.
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
DROP POLICY IF EXISTS "Achievements are viewable by everyone" ON public.achievements;
DROP POLICY IF EXISTS "categories readable by authenticated" ON public.categories;
DROP POLICY IF EXISTS "achievements readable by authenticated" ON public.achievements;
CREATE POLICY "categories readable by authenticated" ON public.categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "achievements readable by authenticated" ON public.achievements
  FOR SELECT TO authenticated USING (true);

-- Tighten generated_questions: no client-side writes; only owner can SELECT.
DROP POLICY IF EXISTS "Users manage own generated_questions" ON public.generated_questions;
DROP POLICY IF EXISTS "Users read own generated_questions" ON public.generated_questions;
CREATE POLICY "Users read own generated_questions" ON public.generated_questions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policies → writes only via service_role.
