
CREATE TABLE public.facts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX facts_question_unique ON public.facts (lower(question));

GRANT SELECT ON public.facts TO anon, authenticated;
GRANT ALL ON public.facts TO service_role;

ALTER TABLE public.facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read facts"
  ON public.facts FOR SELECT
  TO anon, authenticated
  USING (true);
