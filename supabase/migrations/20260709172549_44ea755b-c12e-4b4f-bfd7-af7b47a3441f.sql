
-- ============================================================
-- 1. Role-based admin (replace hardcoded boss email)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Backfill: current boss email becomes admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
WHERE lower(email) = 'ogstreamz196@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- is_boss now checks the roles table
CREATE OR REPLACE FUNCTION public.is_boss(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin'::public.app_role)
$$;

-- ============================================================
-- 2. Remove direct user write policies on stat/xp/achievement tables
-- ============================================================
DROP POLICY IF EXISTS "Users update own stats"        ON public.user_stats;
DROP POLICY IF EXISTS "Users insert own stats"        ON public.user_stats;
DROP POLICY IF EXISTS "own quiz stats update"         ON public.quiz_stats;
DROP POLICY IF EXISTS "own quiz stats write"          ON public.quiz_stats;
DROP POLICY IF EXISTS "Users insert own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "own xp events insert"          ON public.xp_events;
-- Writes now happen exclusively via server code using the service role.

-- ============================================================
-- 3. app_config: signed-in reads only
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read app_config" ON public.app_config;
CREATE POLICY "Authenticated can read app_config" ON public.app_config
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.app_config FROM anon;

-- ============================================================
-- 4. Remove subscriptions from Realtime publication
-- ============================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.subscriptions;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- ============================================================
-- 5. Lock down SECURITY DEFINER helpers not required by RLS
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.boss_decode_fact_code(text)        FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_adult_verified(uuid)             FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.count_unseen_facts(uuid, text)      FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()          FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                   FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.assign_fact_code()                  FROM anon, authenticated, public;
-- Anonymous callers never need is_boss/has_role either
REVOKE EXECUTE ON FUNCTION public.is_boss(uuid)                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)     FROM anon;
