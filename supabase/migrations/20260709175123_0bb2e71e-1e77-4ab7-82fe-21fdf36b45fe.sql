ALTER FUNCTION public.is_adult_verified(uuid) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.is_adult_verified(uuid) FROM anon;