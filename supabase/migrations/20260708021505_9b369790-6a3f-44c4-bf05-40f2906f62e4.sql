
ALTER TABLE public.facts
  ADD COLUMN IF NOT EXISTS fun_fact TEXT;

CREATE INDEX IF NOT EXISTS facts_category_idx ON public.facts (category);
