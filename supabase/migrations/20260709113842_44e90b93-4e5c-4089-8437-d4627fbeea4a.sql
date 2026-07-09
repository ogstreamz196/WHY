
CREATE TABLE public.boss_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID NOT NULL,
  target_user_id UUID,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.boss_audit_log TO authenticated;
GRANT ALL ON public.boss_audit_log TO service_role;

ALTER TABLE public.boss_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss can read audit log"
  ON public.boss_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_boss(auth.uid()));

CREATE INDEX boss_audit_log_created_at_idx ON public.boss_audit_log (created_at DESC);
CREATE INDEX boss_audit_log_target_idx ON public.boss_audit_log (target_user_id);
