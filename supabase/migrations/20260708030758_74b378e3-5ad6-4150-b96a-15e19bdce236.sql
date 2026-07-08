
ALTER TABLE public.facts ADD COLUMN IF NOT EXISTS is_adult boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS facts_is_adult_idx ON public.facts(is_adult);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS adult_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS adult_provider text;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS adult_mode_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_adult_verified(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid AND adult_verified_at IS NOT NULL
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_adult_verified(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_adult_verified(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Anyone can read facts" ON public.facts;
DROP POLICY IF EXISTS "Read non-adult facts" ON public.facts;
CREATE POLICY "Read facts respecting adult gate"
  ON public.facts FOR SELECT
  TO anon, authenticated
  USING (
    is_adult = false
    OR (auth.uid() IS NOT NULL AND public.is_adult_verified(auth.uid()))
  );
