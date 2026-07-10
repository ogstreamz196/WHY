
CREATE TABLE IF NOT EXISTS public.ui_overrides (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.ui_overrides TO anon, authenticated;
GRANT ALL ON public.ui_overrides TO service_role;

ALTER TABLE public.ui_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ui_overrides public read"
  ON public.ui_overrides FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "ui_overrides boss write"
  ON public.ui_overrides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
