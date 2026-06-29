
CREATE TABLE IF NOT EXISTS public.dd_social_proof (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('stat','press_mention','ugc_photo','award')),
  title text NOT NULL,
  content text,
  image_url text,
  source_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dd_social_proof TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_social_proof TO authenticated;
GRANT ALL ON public.dd_social_proof TO service_role;
ALTER TABLE public.dd_social_proof ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social proof public read active"
  ON public.dd_social_proof FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "social proof admin write"
  ON public.dd_social_proof FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.dd_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_type text NOT NULL DEFAULT 'curated' CHECK (bundle_type IN ('curated','custom')),
  name text NOT NULL,
  description text,
  cover_image_url text,
  discount_pct numeric NOT NULL DEFAULT 0,
  valid_until date,
  is_public boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dd_bundles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_bundles TO authenticated;
GRANT ALL ON public.dd_bundles TO service_role;
ALTER TABLE public.dd_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundles public read"
  ON public.dd_bundles FOR SELECT
  USING (is_public = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "bundles admin write"
  ON public.dd_bundles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.dd_bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.dd_bundles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  unit_price numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dd_bundle_items_bundle ON public.dd_bundle_items(bundle_id);
GRANT SELECT ON public.dd_bundle_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_bundle_items TO authenticated;
GRANT ALL ON public.dd_bundle_items TO service_role;
ALTER TABLE public.dd_bundle_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundle items follow bundle read"
  ON public.dd_bundle_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.dd_bundles b WHERE b.id = bundle_id AND (b.is_public = true OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "bundle items admin write"
  ON public.dd_bundle_items FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.dd_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_dd_social_proof_touch ON public.dd_social_proof;
CREATE TRIGGER trg_dd_social_proof_touch BEFORE UPDATE ON public.dd_social_proof
  FOR EACH ROW EXECUTE FUNCTION public.dd_touch_updated_at();
DROP TRIGGER IF EXISTS trg_dd_bundles_touch ON public.dd_bundles;
CREATE TRIGGER trg_dd_bundles_touch BEFORE UPDATE ON public.dd_bundles
  FOR EACH ROW EXECUTE FUNCTION public.dd_touch_updated_at();
