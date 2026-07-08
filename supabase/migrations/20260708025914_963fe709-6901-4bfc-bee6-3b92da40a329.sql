
-- 1) Extend why_chains for save/share/pin
ALTER TABLE public.why_chains
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS why_chains_user_updated_idx
  ON public.why_chains(user_id, updated_at DESC);

-- Public read access when a chain is explicitly shared
DROP POLICY IF EXISTS "Public can view shared chains" ON public.why_chains;
CREATE POLICY "Public can view shared chains"
  ON public.why_chains FOR SELECT
  USING (is_public = true);

DROP POLICY IF EXISTS "Public can view shared chain steps" ON public.why_chain_steps;
CREATE POLICY "Public can view shared chain steps"
  ON public.why_chain_steps FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.why_chains c
    WHERE c.id = why_chain_steps.chain_id AND c.is_public = true
  ));

GRANT SELECT ON public.why_chains TO anon;
GRANT SELECT ON public.why_chain_steps TO anon;

-- 2) chain_collections
CREATE TABLE IF NOT EXISTS public.chain_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chain_collections TO authenticated;
GRANT ALL ON public.chain_collections TO service_role;
ALTER TABLE public.chain_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own collections" ON public.chain_collections;
CREATE POLICY "Users manage own collections"
  ON public.chain_collections FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_chain_collections_updated_at ON public.chain_collections;
CREATE TRIGGER update_chain_collections_updated_at
  BEFORE UPDATE ON public.chain_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) chain_collection_items
CREATE TABLE IF NOT EXISTS public.chain_collection_items (
  collection_id uuid NOT NULL REFERENCES public.chain_collections(id) ON DELETE CASCADE,
  chain_id uuid NOT NULL REFERENCES public.why_chains(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, chain_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chain_collection_items TO authenticated;
GRANT ALL ON public.chain_collection_items TO service_role;
ALTER TABLE public.chain_collection_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own collection items" ON public.chain_collection_items;
CREATE POLICY "Users manage own collection items"
  ON public.chain_collection_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) category_interests
CREATE TABLE IF NOT EXISTS public.category_interests (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  weight integer NOT NULL DEFAULT 0,
  last_engaged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_interests TO authenticated;
GRANT ALL ON public.category_interests TO service_role;
ALTER TABLE public.category_interests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own category interests" ON public.category_interests;
CREATE POLICY "Users manage own category interests"
  ON public.category_interests FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
