-- Server-backed coins for reading "But… Why?" chain layers.
--
-- generateWhyLayer issues one row per layer served to a signed-in user; the
-- client claims it after the 3-second read. A row can be claimed once, only by
-- its owner, and only once it is a few seconds old.

CREATE TABLE IF NOT EXISTS public.chain_layer_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz
);
CREATE INDEX IF NOT EXISTS chain_layer_rewards_user_claimed_idx
  ON public.chain_layer_rewards (user_id, claimed_at DESC);

ALTER TABLE public.chain_layer_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chain_layer_rewards FROM anon, authenticated;
GRANT ALL ON public.chain_layer_rewards TO service_role;

-- Allow chain rewards in the XP ledger.
ALTER TABLE public.xp_events DROP CONSTRAINT IF EXISTS xp_events_source_check;
ALTER TABLE public.xp_events
  ADD CONSTRAINT xp_events_source_check
  CHECK (source IN ('quiz','discovery','daily','streak','achievement','login','mission','chain'));
