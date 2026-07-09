
-- Tighten profiles SELECT: restrict base table to owner; expose a safe public view.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Public-safe projection: excludes adult_verified_at, adult_provider; honors hide_from_public.
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT id, display_name, username, avatar_id, bio, created_at, updated_at,
       age_band, favorite_category, leaderboard_opt_out, hide_from_public
FROM public.profiles
WHERE hide_from_public = false;

GRANT SELECT ON public.profiles_public TO anon, authenticated;
