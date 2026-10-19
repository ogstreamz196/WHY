-- Username accounts sign in by looking their username up in profiles.username
-- (their email changes once a recovery email is added), and sign-up checks the
-- same column to stop two players taking one name. Until now nothing wrote it.

-- 1. New accounts: copy the username from the sign-up metadata. If the name is
--    somehow already used (any letter case), leave it empty rather than make
--    the whole sign-up fail.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT := NULLIF(btrim(NEW.raw_user_meta_data->>'username'), '');
BEGIN
  IF v_username IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_username)
  ) THEN
    v_username := NULL;
  END IF;
  INSERT INTO public.profiles (id, display_name, username)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
      v_username
    )
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 2. Existing accounts: fill in usernames from their sign-up metadata. When two
--    accounts share a name ignoring case, the older one keeps it.
WITH candidates AS (
  SELECT DISTINCT ON (lower(btrim(u.raw_user_meta_data->>'username')))
         p.id, btrim(u.raw_user_meta_data->>'username') AS username
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
   WHERE p.username IS NULL
     AND NULLIF(btrim(u.raw_user_meta_data->>'username'), '') IS NOT NULL
   ORDER BY lower(btrim(u.raw_user_meta_data->>'username')), u.created_at
)
UPDATE public.profiles p
   SET username = c.username
  FROM candidates c
 WHERE p.id = c.id
   AND NOT EXISTS (
     SELECT 1 FROM public.profiles o WHERE lower(o.username) = lower(c.username)
   );

-- 3. Usernames are unique ignoring case ("Bob" and "bob" are the same name).
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
    ON public.profiles (lower(username));
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'profiles_username_lower_key not created: usernames clash ignoring case';
END;
$$;

-- 4. A username is a sign-in name, so players can't change it from the app
--    (that could lock them out, or squat someone else's sign-in name). Only
--    the server (service role) sets it.
CREATE OR REPLACE FUNCTION public.keep_profile_username()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.username := NULL;
    ELSIF NEW.username IS DISTINCT FROM OLD.username THEN
      NEW.username := OLD.username;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.keep_profile_username() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS keep_profile_username ON public.profiles;
CREATE TRIGGER keep_profile_username
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.keep_profile_username();
