-- Fair play fixes.
--
-- 1. first_discoveries: one row per (player, fact), written only by the
--    server. Inserting with ON CONFLICT DO NOTHING tells the server whether
--    this is really the first time, so a coin and a facts_seen can't be
--    earned twice for one fact (even with parallel requests). The discoveries
--    log (repeat views, timeline) is now written by the server only too.
-- 2. quiz_question_serves: when each quiz question's answers were revealed,
--    so the quiz speed bonus is timed on the server, not by the browser.
-- 3. Players can't change avatar_id or status_message by writing to profiles
--    directly; updateMyProfile checks ownership / Plus and saves them with
--    the service role.
-- 4. claim_chain_layer_reward: counts today's chain-layer claims and claims
--    the ticket under a per-player lock, so parallel claims can't pass the
--    daily cap.

-- ---------- 1. First discoveries ----------
CREATE TABLE IF NOT EXISTS public.first_discoveries (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact_id uuid NOT NULL REFERENCES public.facts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, fact_id)
);
CREATE INDEX IF NOT EXISTS first_discoveries_user_time_idx
  ON public.first_discoveries (user_id, created_at DESC);

ALTER TABLE public.first_discoveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.first_discoveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.first_discoveries TO service_role;

-- Everything already seen counts as discovered (earliest view wins).
INSERT INTO public.first_discoveries (user_id, fact_id, created_at)
SELECT d.user_id, d.fact_id, min(d.seen_at)
  FROM public.discoveries d
 GROUP BY d.user_id, d.fact_id
ON CONFLICT (user_id, fact_id) DO NOTHING;

-- The discoveries log feeds achievements and the daily mission, so only the
-- server (recordDiscovery) may add to it. Players can still read their own.
DROP POLICY IF EXISTS "Users insert own discoveries" ON public.discoveries;
REVOKE INSERT, UPDATE, DELETE ON public.discoveries FROM anon, authenticated;

-- ---------- 2. Quiz question serve times ----------
CREATE TABLE IF NOT EXISTS public.quiz_question_serves (
  session_id uuid NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  fact_id uuid NOT NULL,
  served_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, fact_id)
);

ALTER TABLE public.quiz_question_serves ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_question_serves FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.quiz_question_serves TO service_role;

-- ---------- 3. Guard avatar_id / status_message ----------
CREATE OR REPLACE FUNCTION public.guard_profile_server_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.avatar_id := 'avatar-sprout';
      NEW.status_message := NULL;
    ELSE
      NEW.avatar_id := OLD.avatar_id;
      NEW.status_message := OLD.status_message;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_profile_server_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_profile_server_fields ON public.profiles;
CREATE TRIGGER guard_profile_server_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_server_fields();

-- ---------- 4. Atomic chain-layer claim ----------
CREATE OR REPLACE FUNCTION public.claim_chain_layer_reward(
  _user uuid,
  _reward uuid,
  _daily_cap integer,
  _min_read_ms integer,
  _ttl_ms integer
)
RETURNS TABLE (out_status text, out_claimed_today integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  claimed_today integer;
  updated integer;
BEGIN
  -- One claim at a time per player, until this transaction ends.
  PERFORM pg_advisory_xact_lock(hashtextextended('chain_layer_reward:' || _user::text, 0));

  SELECT count(*) INTO claimed_today
    FROM public.chain_layer_rewards r
   WHERE r.user_id = _user
     AND r.claimed_at >= day_start;

  IF claimed_today >= _daily_cap THEN
    RETURN QUERY SELECT 'daily_cap'::text, claimed_today;
    RETURN;
  END IF;

  UPDATE public.chain_layer_rewards r
     SET claimed_at = now()
   WHERE r.id = _reward
     AND r.user_id = _user
     AND r.claimed_at IS NULL
     AND r.issued_at <= now() - make_interval(secs => _min_read_ms / 1000.0)
     AND r.issued_at >= now() - make_interval(secs => _ttl_ms / 1000.0);
  GET DIAGNOSTICS updated = ROW_COUNT;

  IF updated = 0 THEN
    RETURN QUERY SELECT 'invalid'::text, claimed_today;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'ok'::text, claimed_today + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_chain_layer_reward(uuid, uuid, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_chain_layer_reward(uuid, uuid, integer, integer, integer)
  TO service_role;
