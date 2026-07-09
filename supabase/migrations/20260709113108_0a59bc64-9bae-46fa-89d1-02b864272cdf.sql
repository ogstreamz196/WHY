
CREATE OR REPLACE FUNCTION public.is_boss(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _uid AND lower(email) = 'ogstreamz196@gmail.com'
  );
$$;

CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.app_config TO anon, authenticated;
GRANT ALL ON public.app_config TO service_role;

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app_config" ON public.app_config;
CREATE POLICY "Anyone can read app_config" ON public.app_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Boss can write app_config" ON public.app_config;
CREATE POLICY "Boss can write app_config" ON public.app_config
  FOR ALL TO authenticated
  USING (public.is_boss(auth.uid()))
  WITH CHECK (public.is_boss(auth.uid()));

INSERT INTO public.app_config (key, value) VALUES
  ('privileges', jsonb_build_object(
    'free',  jsonb_build_object('daily_facts_limit', 20, 'quiz_daily_limit', 3, 'coin_multiplier', 1.0, 'ads_enabled', true),
    'vip',   jsonb_build_object('daily_facts_limit', 999, 'quiz_daily_limit', 999, 'coin_multiplier', 1.5, 'ads_enabled', false)
  ))
ON CONFLICT (key) DO NOTHING;
