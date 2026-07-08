
CREATE OR REPLACE FUNCTION public.is_adult_verified(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid AND adult_verified_at IS NOT NULL
  );
$$;
