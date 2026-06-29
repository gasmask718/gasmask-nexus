ALTER TABLE public.dd_catalog_drafts
  ADD COLUMN IF NOT EXISTS price_research jsonb,
  ADD COLUMN IF NOT EXISTS image_variants jsonb,
  ADD COLUMN IF NOT EXISTS recognition jsonb;