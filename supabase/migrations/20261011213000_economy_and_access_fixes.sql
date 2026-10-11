-- Economy & access fixes.
--
-- 1. Coins are only ever changed through atomic, service-role-only functions
--    so two concurrent requests can't both read the same balance.
-- 2. Quiz sessions/answers/questions and daily missions become read-only for
--    clients (server functions write via the service role). The correct-answer
--    order and the quiz answer key are no longer readable from the browser.
-- 3. Store purchases are recorded server-side in user_inventory.
-- 4. Login-bonus streak gets its own column instead of reusing the
--    daily-challenge streak.
-- 5. Per-user AI usage log for rate limiting.

-- ---------- 1. Atomic points ----------
CREATE OR REPLACE FUNCTION public.apply_points(_user uuid, _points integer, _facts_seen integer DEFAULT 0)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_total integer;
BEGIN
  INSERT INTO public.user_stats (user_id) VALUES (_user) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.user_stats us
     SET total_points = us.total_points + _points,
         facts_seen   = us.facts_seen + COALESCE(_facts_seen, 0)
   WHERE us.user_id = _user
     AND us.total_points + _points >= 0
  RETURNING us.total_points INTO new_total;
  -- NULL means the debit would have taken the balance below zero.
  RETURN new_total;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_points(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_points(uuid, integer, integer) TO service_role;

-- ---------- 2. Quiz lockdown ----------
DROP POLICY IF EXISTS "own quiz sessions write"  ON public.quiz_sessions;
DROP POLICY IF EXISTS "own quiz sessions update" ON public.quiz_sessions;
REVOKE INSERT, UPDATE, DELETE ON public.quiz_sessions FROM anon, authenticated;
-- Hide answer_order (the answer key) while keeping the rest readable by the owner.
REVOKE SELECT ON public.quiz_sessions FROM anon, authenticated;
GRANT SELECT (id, user_id, category, difficulty, question_count, correct_count, score, accuracy,
              fact_ids, started_at, finished_at, created_at)
  ON public.quiz_sessions TO authenticated;

DROP POLICY IF EXISTS "own quiz answers write" ON public.quiz_answers;
REVOKE INSERT, UPDATE, DELETE ON public.quiz_answers FROM anon, authenticated;

DROP POLICY IF EXISTS "quiz_questions readable by authenticated" ON public.quiz_questions;
REVOKE ALL ON public.quiz_questions FROM anon, authenticated;

-- Allow -1 to record "ran out of time".
ALTER TABLE public.quiz_answers DROP CONSTRAINT IF EXISTS quiz_answers_picked_index_check;
ALTER TABLE public.quiz_answers
  ADD CONSTRAINT quiz_answers_picked_index_check CHECK (picked_index BETWEEN -1 AND 3);

-- ---------- 2b. Daily missions lockdown ----------
DROP POLICY IF EXISTS "Users manage their own missions" ON public.daily_missions;
DROP POLICY IF EXISTS "Users read own missions" ON public.daily_missions;
CREATE POLICY "Users read own missions" ON public.daily_missions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE INSERT, UPDATE, DELETE ON public.daily_missions FROM anon, authenticated;

-- ---------- 3. Server-side inventory ----------
CREATE TABLE IF NOT EXISTS public.user_inventory (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  cost integer NOT NULL DEFAULT 0,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_inventory FROM anon, authenticated;
GRANT SELECT ON public.user_inventory TO authenticated;
GRANT ALL ON public.user_inventory TO service_role;
DROP POLICY IF EXISTS "Users read own inventory" ON public.user_inventory;
CREATE POLICY "Users read own inventory" ON public.user_inventory
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Keep avatars that people already bought and equipped before inventory
-- was stored on the server.
INSERT INTO public.user_inventory (user_id, item_id)
SELECT p.id, p.avatar_id
  FROM public.profiles p
 WHERE p.avatar_id LIKE 'avatar-%'
   AND p.avatar_id NOT LIKE 'avatar-vip-%'
   AND p.avatar_id <> 'avatar-sprout'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.purchase_item(_user uuid, _item text, _cost integer)
RETURNS TABLE (out_status text, out_total integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted integer;
  bal integer;
BEGIN
  IF _cost < 0 THEN
    RAISE EXCEPTION 'invalid cost';
  END IF;

  INSERT INTO public.user_stats (user_id) VALUES (_user) ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_inventory (user_id, item_id, cost)
  VALUES (_user, _item, _cost)
  ON CONFLICT (user_id, item_id) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;

  IF inserted = 0 THEN
    SELECT us.total_points INTO bal FROM public.user_stats us WHERE us.user_id = _user;
    RETURN QUERY SELECT 'already_owned'::text, COALESCE(bal, 0);
    RETURN;
  END IF;

  UPDATE public.user_stats us
     SET total_points = us.total_points - _cost
   WHERE us.user_id = _user
     AND us.total_points >= _cost
  RETURNING us.total_points INTO bal;

  IF NOT FOUND THEN
    DELETE FROM public.user_inventory ui WHERE ui.user_id = _user AND ui.item_id = _item;
    SELECT us.total_points INTO bal FROM public.user_stats us WHERE us.user_id = _user;
    RETURN QUERY SELECT 'insufficient_coins'::text, COALESCE(bal, 0);
    RETURN;
  END IF;

  RETURN QUERY SELECT 'ok'::text, bal;
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_item(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_item(uuid, text, integer) TO service_role;

-- ---------- 4. Separate login streak ----------
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS login_streak integer NOT NULL DEFAULT 0;

-- ---------- 5. AI usage log (rate limiting) ----------
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_user_time_idx ON public.ai_usage (user_id, created_at DESC);
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage FROM anon, authenticated;
GRANT ALL ON public.ai_usage TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ai_usage_id_seq TO service_role;
