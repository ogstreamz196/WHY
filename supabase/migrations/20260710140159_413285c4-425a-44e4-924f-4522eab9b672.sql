CREATE OR REPLACE FUNCTION public.get_public_leaderboard(
  _kind text DEFAULT 'global',
  _filter text DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  avatar_id text,
  age_band text,
  favorite_category text,
  score integer,
  created_at timestamptz,
  category text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window_days integer;
  _since timestamptz;
BEGIN
  IF _kind = 'global' THEN
    RETURN QUERY
      SELECT
        p.id,
        p.username,
        p.display_name,
        p.avatar_id,
        p.age_band,
        p.favorite_category,
        COALESCE(us.total_points, 0)::integer AS score,
        p.created_at,
        NULL::text AS category
      FROM public.profiles p
      LEFT JOIN public.user_stats us ON us.user_id = p.id
      WHERE COALESCE(p.leaderboard_opt_out, false) = false
        AND COALESCE(p.hide_from_public, false) = false
      ORDER BY COALESCE(us.total_points, 0) DESC NULLS LAST, p.created_at ASC;

  ELSIF _kind = 'age' THEN
    RETURN QUERY
      SELECT
        p.id,
        p.username,
        p.display_name,
        p.avatar_id,
        p.age_band,
        p.favorite_category,
        COALESCE(us.total_points, 0)::integer AS score,
        p.created_at,
        NULL::text AS category
      FROM public.profiles p
      LEFT JOIN public.user_stats us ON us.user_id = p.id
      WHERE COALESCE(p.leaderboard_opt_out, false) = false
        AND COALESCE(p.hide_from_public, false) = false
        AND p.age_band = COALESCE(_filter, 'adult')
      ORDER BY COALESCE(us.total_points, 0) DESC NULLS LAST, p.created_at ASC;

  ELSIF _kind = 'category' THEN
    RETURN QUERY
      SELECT
        e.user_id,
        p.username,
        p.display_name,
        p.avatar_id,
        p.age_band,
        p.favorite_category,
        COALESCE(SUM(e.points), 0)::integer AS score,
        p.created_at,
        e.category
      FROM public.xp_events e
      JOIN public.profiles p ON p.id = e.user_id
      WHERE e.category IS NOT NULL
        AND e.category = COALESCE(_filter, e.category)
        AND COALESCE(p.leaderboard_opt_out, false) = false
        AND COALESCE(p.hide_from_public, false) = false
      GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category, p.created_at, e.category
      ORDER BY COALESCE(SUM(e.points), 0) DESC NULLS LAST, p.created_at ASC;

  ELSIF _kind = 'window' THEN
    _window_days := CASE WHEN _filter = 'daily' THEN 1 WHEN _filter = 'monthly' THEN 30 ELSE 7 END;
    _since := now() - make_interval(days => _window_days);
    RETURN QUERY
      SELECT
        e.user_id,
        p.username,
        p.display_name,
        p.avatar_id,
        p.age_band,
        p.favorite_category,
        COALESCE(SUM(e.points), 0)::integer AS score,
        MAX(e.created_at) AS created_at,
        NULL::text AS category
      FROM public.xp_events e
      JOIN public.profiles p ON p.id = e.user_id
      WHERE e.created_at >= _since
        AND COALESCE(p.leaderboard_opt_out, false) = false
        AND COALESCE(p.hide_from_public, false) = false
      GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category
      ORDER BY COALESCE(SUM(e.points), 0) DESC NULLS LAST, MAX(e.created_at) ASC;

  ELSIF _kind = 'rising' THEN
    RETURN QUERY
      SELECT
        e.user_id,
        p.username,
        p.display_name,
        p.avatar_id,
        p.age_band,
        p.favorite_category,
        COALESCE(SUM(e.points), 0)::integer AS score,
        MAX(e.created_at) AS created_at,
        NULL::text AS category
      FROM public.xp_events e
      JOIN public.profiles p ON p.id = e.user_id
      WHERE e.created_at >= now() - interval '7 days'
        AND COALESCE(p.leaderboard_opt_out, false) = false
        AND COALESCE(p.hide_from_public, false) = false
      GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category
      ORDER BY COALESCE(SUM(e.points), 0) DESC NULLS LAST, MAX(e.created_at) ASC;

  ELSIF _kind = 'streaks' THEN
    RETURN QUERY
      SELECT
        p.id,
        p.username,
        p.display_name,
        p.avatar_id,
        p.age_band,
        p.favorite_category,
        COALESCE(us.current_streak, 0)::integer AS score,
        p.created_at,
        NULL::text AS category
      FROM public.profiles p
      LEFT JOIN public.user_stats us ON us.user_id = p.id
      WHERE COALESCE(us.current_streak, 0) > 0
        AND COALESCE(p.leaderboard_opt_out, false) = false
        AND COALESCE(p.hide_from_public, false) = false
      ORDER BY COALESCE(us.current_streak, 0) DESC NULLS LAST, p.created_at ASC;

  ELSIF _kind = 'weekend' THEN
    RETURN QUERY
      SELECT
        e.user_id,
        p.username,
        p.display_name,
        p.avatar_id,
        p.age_band,
        p.favorite_category,
        COALESCE(SUM(e.points), 0)::integer AS score,
        MAX(e.created_at) AS created_at,
        NULL::text AS category
      FROM public.xp_events e
      JOIN public.profiles p ON p.id = e.user_id
      WHERE e.created_at >= now() - interval '30 days'
        AND EXTRACT(isodow FROM e.created_at) IN (6, 7)
        AND COALESCE(p.leaderboard_opt_out, false) = false
        AND COALESCE(p.hide_from_public, false) = false
      GROUP BY e.user_id, p.username, p.display_name, p.avatar_id, p.age_band, p.favorite_category
      ORDER BY COALESCE(SUM(e.points), 0) DESC NULLS LAST, MAX(e.created_at) ASC;

  ELSIF _kind = 'new' THEN
    RETURN QUERY
      SELECT
        p.id,
        p.username,
        p.display_name,
        p.avatar_id,
        p.age_band,
        p.favorite_category,
        COALESCE(us.total_points, 0)::integer AS score,
        p.created_at,
        NULL::text AS category
      FROM public.profiles p
      LEFT JOIN public.user_stats us ON us.user_id = p.id
      WHERE p.created_at >= now() - interval '14 days'
        AND COALESCE(p.leaderboard_opt_out, false) = false
        AND COALESCE(p.hide_from_public, false) = false
      ORDER BY COALESCE(us.total_points, 0) DESC NULLS LAST, p.created_at ASC;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_leaderboard(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_leaderboard(text, text) TO anon, authenticated, service_role;