-- Avatar dress-up: what each player's avatar is wearing (hat, face gear,
-- held item, jewellery, pet, aura), as item ids from the store catalog.
-- Items are cosmetic and bought with earned coins (user_inventory) or gifted
-- as free drops; the server checks ownership before saving.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_outfit jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_avatar_outfit_is_object;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_outfit_is_object
  CHECK (jsonb_typeof(avatar_outfit) = 'object' AND pg_column_size(avatar_outfit) < 2048);

-- Players update their own profile row directly, so stop them writing the
-- outfit that way: only the server (service role), which checks ownership,
-- may change it.
CREATE OR REPLACE FUNCTION public.guard_avatar_outfit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NEW.avatar_outfit IS DISTINCT FROM OLD.avatar_outfit THEN
    NEW.avatar_outfit := OLD.avatar_outfit;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_avatar_outfit ON public.profiles;
CREATE TRIGGER guard_avatar_outfit
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_avatar_outfit();
