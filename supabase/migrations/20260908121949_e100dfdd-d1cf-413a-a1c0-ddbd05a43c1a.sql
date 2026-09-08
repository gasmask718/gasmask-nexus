ALTER TABLE public.products_all
  ADD COLUMN IF NOT EXISTS shipping_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_data_source text,
  ADD COLUMN IF NOT EXISTS source_draft_id uuid REFERENCES public.dd_catalog_drafts(id) ON DELETE SET NULL;

ALTER TABLE public.products_all
  DROP CONSTRAINT IF EXISTS products_all_shipping_data_source_check;
ALTER TABLE public.products_all
  ADD CONSTRAINT products_all_shipping_data_source_check
  CHECK (shipping_data_source IS NULL OR shipping_data_source IN ('label_ocr','sourced_web','human_measured','estimate','manual','unknown'));

CREATE INDEX IF NOT EXISTS products_all_source_draft_id_idx ON public.products_all(source_draft_id) WHERE source_draft_id IS NOT NULL;

COMMENT ON COLUMN public.products_all.shipping_verified IS 'true only when a human confirmed weight/dimensions on the intake draft (measurements_verified_at set). Never set by AI or web lookups.';
COMMENT ON COLUMN public.products_all.shipping_data_source IS 'Provenance of weight_oz/length_in/width_in/height_in: label_ocr | sourced_web | human_measured | estimate | manual | unknown';
COMMENT ON COLUMN public.products_all.source_draft_id IS 'dd_catalog_drafts.id this product was published from.';

ALTER TABLE public.dd_catalog_drafts
  ADD COLUMN IF NOT EXISTS sourced_specs jsonb;
COMMENT ON COLUMN public.dd_catalog_drafts.sourced_specs IS 'SerpAPI-sourced weight/dimension lookup: { status: sourced|needs_measurement|unavailable, weight, dimensions, sources[], suggested_box, checked_at }';