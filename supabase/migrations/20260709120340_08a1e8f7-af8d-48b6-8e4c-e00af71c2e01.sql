
ALTER TABLE public.facts
  ALTER COLUMN code SET DEFAULT ('WHY-' || upper(substr(md5(gen_random_uuid()::text || '::why-code-v1'), 1, 6))),
  ALTER COLUMN code_seq SET DEFAULT 0;
