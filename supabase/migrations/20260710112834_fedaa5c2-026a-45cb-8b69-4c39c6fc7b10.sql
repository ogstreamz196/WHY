
REVOKE ALL ON FUNCTION public.claim_champion_title(text, uuid, integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_champion_title(text, uuid, integer, uuid) TO service_role;
