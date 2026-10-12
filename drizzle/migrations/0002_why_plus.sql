-- Why? Plus: subscriptions bought through Google Play / the App Store,
-- synced from RevenueCat by the server (website Paddle subscriptions stay
-- in public.subscriptions). One row per user; the server re-reads the
-- subscriber from RevenueCat on every webhook, so this is always the
-- latest known state.
CREATE TABLE IF NOT EXISTS public.plus_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text,
  store text,
  expires_at timestamptz,
  will_renew boolean NOT NULL DEFAULT false,
  billing_issue boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plus_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plus_entitlements FROM anon, authenticated;
GRANT SELECT ON public.plus_entitlements TO authenticated;
GRANT ALL ON public.plus_entitlements TO service_role;
DROP POLICY IF EXISTS "Users read own plus entitlement" ON public.plus_entitlements;
CREATE POLICY "Users read own plus entitlement" ON public.plus_entitlements
  FOR SELECT TO authenticated USING (auth.uid() = user_id);