
-- 1. Categories table
CREATE TABLE public.categories (
  key text PRIMARY KEY,
  label text NOT NULL,
  emoji text,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories readable by all" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "boss manages categories" ON public.categories FOR ALL TO authenticated
  USING (public.is_boss(auth.uid())) WITH CHECK (public.is_boss(auth.uid()));

INSERT INTO public.categories (key, label, emoji, sort_order) VALUES
  ('animals','Animals','🐾',10),
  ('space','Space','🚀',20),
  ('earth','Earth','🌍',30),
  ('science','Science','🔬',40),
  ('body','Body','🧬',50),
  ('weather','Weather','⛅',60),
  ('food','Food','🍎',70),
  ('history','History','🏛️',80),
  ('technology','Technology','💻',90),
  ('ocean','Ocean','🌊',100),
  ('dinosaurs','Dinosaurs','🦖',110),
  ('nature','Nature','🌿',120)
ON CONFLICT (key) DO NOTHING;

-- 2. Add code + per-category ordinal to facts
ALTER TABLE public.facts
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS code_seq bigint;

-- Trigger: assign opaque code + per-category ordinal on insert
CREATE OR REPLACE FUNCTION public.assign_fact_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_seq bigint;
BEGIN
  IF NEW.code_seq IS NULL THEN
    SELECT COALESCE(MAX(code_seq), 0) + 1 INTO next_seq
      FROM public.facts
      WHERE category IS NOT DISTINCT FROM NEW.category;
    NEW.code_seq := next_seq;
  END IF;
  IF NEW.code IS NULL THEN
    -- Opaque code: users can't tell order or category from it.
    NEW.code := 'WHY-' || upper(substr(md5(COALESCE(NEW.id::text, gen_random_uuid()::text) || '::why-code-v1'), 1, 6));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_fact_code ON public.facts;
CREATE TRIGGER trg_assign_fact_code BEFORE INSERT ON public.facts
  FOR EACH ROW EXECUTE FUNCTION public.assign_fact_code();

-- Backfill existing rows (ordered by creation)
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY category ORDER BY created_at, id) AS rn
  FROM public.facts
)
UPDATE public.facts f
   SET code_seq = ranked.rn,
       code = 'WHY-' || upper(substr(md5(f.id::text || '::why-code-v1'), 1, 6))
  FROM ranked
 WHERE f.id = ranked.id AND (f.code IS NULL OR f.code_seq IS NULL);

ALTER TABLE public.facts
  ALTER COLUMN code SET NOT NULL,
  ALTER COLUMN code_seq SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS facts_code_unique ON public.facts (code);
CREATE INDEX IF NOT EXISTS facts_category_seq_idx ON public.facts (category, code_seq);

-- 3. Boss-only decoder
CREATE OR REPLACE FUNCTION public.boss_decode_fact_code(_code text)
RETURNS TABLE (
  id uuid,
  code text,
  code_seq bigint,
  category text,
  question text,
  answer text,
  fun_fact text,
  source text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT f.id, f.code, f.code_seq, f.category, f.question, f.answer, f.fun_fact, f.source, f.created_at
  FROM public.facts f
  WHERE f.code = _code
    AND public.is_boss(auth.uid())
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.boss_decode_fact_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.boss_decode_fact_code(text) TO authenticated;

-- 4. Unseen-count helper (used by the app to know if user has exhausted pool)
CREATE OR REPLACE FUNCTION public.count_unseen_facts(_user uuid, _category text DEFAULT NULL)
RETURNS bigint
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT count(*) FROM public.facts f
  WHERE (_category IS NULL OR f.category = _category)
    AND NOT EXISTS (
      SELECT 1 FROM public.discoveries d
      WHERE d.user_id = _user AND d.fact_id = f.id
    );
$$;
GRANT EXECUTE ON FUNCTION public.count_unseen_facts(uuid, text) TO authenticated;
