
-- Content Factory: per-product briefs + generated assets
CREATE TABLE public.dd_content_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products_all(id) ON DELETE CASCADE,
  draft_id uuid REFERENCES public.dd_catalog_drafts(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  brand_name text,
  hero_image_url text,
  -- AI-generated concepts
  ugc_concepts jsonb NOT NULL DEFAULT '[]'::jsonb,        -- [{hook, script, persona, platform}]
  photoshoot_concepts jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{title, mood, props, lighting, composition, prompt}]
  social_captions jsonb NOT NULL DEFAULT '[]'::jsonb,      -- [{platform, caption, hashtags}]
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','generating','ready','failed','archived')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_content_briefs TO authenticated;
GRANT ALL ON public.dd_content_briefs TO service_role;

ALTER TABLE public.dd_content_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all content briefs" ON public.dd_content_briefs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

CREATE POLICY "Creators see their own briefs" ON public.dd_content_briefs
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE TRIGGER trg_dd_content_briefs_updated_at
BEFORE UPDATE ON public.dd_content_briefs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_dd_content_briefs_product ON public.dd_content_briefs(product_id);
CREATE INDEX idx_dd_content_briefs_status ON public.dd_content_briefs(status);

-- Generated assets (images produced by the pipeline against a brief)
CREATE TABLE public.dd_content_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid REFERENCES public.dd_content_briefs(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products_all(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('enhanced','staged','ugc_still','social_card','hero','other')),
  image_url text NOT NULL,
  prompt text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_content_assets TO authenticated;
GRANT ALL ON public.dd_content_assets TO service_role;

ALTER TABLE public.dd_content_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all content assets" ON public.dd_content_assets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

CREATE INDEX idx_dd_content_assets_brief ON public.dd_content_assets(brief_id);
CREATE INDEX idx_dd_content_assets_product ON public.dd_content_assets(product_id);
