-- 18+ mode (website only). Adult facts live in their own table that nobody
-- can read directly: only the server (service role) serves them, after
-- checking the player is 18+ by their saved birth date, has switched 18+ mode
-- on, and isn't using the Android/iOS app.

CREATE TABLE IF NOT EXISTS public.adult_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  fun_fact text,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS adult_facts_created_idx ON public.adult_facts (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS adult_facts_question_key ON public.adult_facts (lower(question));

ALTER TABLE public.adult_facts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.adult_facts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.adult_facts TO service_role;

-- Keep any adult rows that were stored in the main facts table, in the new table.
INSERT INTO public.adult_facts (question, answer, fun_fact, category, created_at)
SELECT f.question, f.answer, f.fun_fact, f.category, f.created_at
FROM public.facts f
WHERE f.is_adult = true
ON CONFLICT DO NOTHING;

-- The main facts table feeds the kids' app: never show adult rows from it,
-- to anyone. (Previously age-verified accounts could see them in the main feed.)
DROP POLICY IF EXISTS "Read facts respecting adult gate" ON public.facts;
DROP POLICY IF EXISTS "Read kid-safe facts" ON public.facts;
CREATE POLICY "Read kid-safe facts"
  ON public.facts FOR SELECT
  TO anon, authenticated
  USING (is_adult = false);