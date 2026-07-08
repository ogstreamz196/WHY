-- Add sync-related columns to facts
ALTER TABLE public.facts
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'ai',
  ADD COLUMN IF NOT EXISTS sheet_id text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS facts_sheet_id_key ON public.facts(sheet_id) WHERE sheet_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_facts_updated_at ON public.facts;
CREATE TRIGGER trg_facts_updated_at BEFORE UPDATE ON public.facts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
