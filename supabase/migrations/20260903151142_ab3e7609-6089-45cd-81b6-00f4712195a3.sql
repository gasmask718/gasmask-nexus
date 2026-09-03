ALTER TABLE public.products_all
  ADD COLUMN IF NOT EXISTS upc text,
  ADD COLUMN IF NOT EXISTS gtin text,
  ADD COLUMN IF NOT EXISTS supplier_sku text,
  ADD COLUMN IF NOT EXISTS spec_source text,
  ADD COLUMN IF NOT EXISTS spec_source_ref jsonb,
  ADD COLUMN IF NOT EXISTS specs_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS specs_verified_by uuid;

ALTER TABLE public.products_all
  DROP CONSTRAINT IF EXISTS products_all_spec_source_check;
ALTER TABLE public.products_all
  ADD CONSTRAINT products_all_spec_source_check
  CHECK (spec_source IS NULL OR spec_source IN ('label_ocr','manual','estimate','import'));

ALTER TABLE public.products_all
  DROP CONSTRAINT IF EXISTS products_all_gtin_digits_check;
ALTER TABLE public.products_all
  ADD CONSTRAINT products_all_gtin_digits_check
  CHECK (gtin IS NULL OR gtin ~ '^[0-9]{14}$');

CREATE INDEX IF NOT EXISTS products_all_gtin_idx ON public.products_all (gtin) WHERE gtin IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_all_supplier_sku_idx ON public.products_all (wholesaler_id, supplier_sku) WHERE supplier_sku IS NOT NULL;

-- Shipping columns are authoritative; the legacy jsonb stays mirrored for compatibility.
CREATE OR REPLACE FUNCTION public.dd_sync_shipping_dimensions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Fill authoritative columns from the legacy jsonb only when the column is empty.
  IF NEW.length_in IS NULL THEN
    NEW.length_in := COALESCE(NULLIF(NEW.dimensions->>'length_in','')::numeric, NULLIF(NEW.dimensions->>'length','')::numeric);
  END IF;
  IF NEW.width_in IS NULL THEN
    NEW.width_in := COALESCE(NULLIF(NEW.dimensions->>'width_in','')::numeric, NULLIF(NEW.dimensions->>'width','')::numeric);
  END IF;
  IF NEW.height_in IS NULL THEN
    NEW.height_in := COALESCE(NULLIF(NEW.dimensions->>'height_in','')::numeric, NULLIF(NEW.dimensions->>'height','')::numeric);
  END IF;

  -- Mirror columns back into the jsonb so there is never a second, divergent source.
  IF NEW.length_in IS NOT NULL OR NEW.width_in IS NOT NULL OR NEW.height_in IS NOT NULL THEN
    NEW.dimensions := COALESCE(NEW.dimensions, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'length_in', NEW.length_in,
      'width_in',  NEW.width_in,
      'height_in', NEW.height_in
    ));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dd_aa_sync_shipping_dimensions_trg ON public.products_all;
CREATE TRIGGER dd_aa_sync_shipping_dimensions_trg
BEFORE INSERT OR UPDATE ON public.products_all
FOR EACH ROW EXECUTE FUNCTION public.dd_sync_shipping_dimensions();

-- One-time, non-destructive backfill: jsonb-only dimensions become real columns.
UPDATE public.products_all
SET length_in = COALESCE(length_in, NULLIF(dimensions->>'length_in','')::numeric, NULLIF(dimensions->>'length','')::numeric),
    width_in  = COALESCE(width_in,  NULLIF(dimensions->>'width_in','')::numeric,  NULLIF(dimensions->>'width','')::numeric),
    height_in = COALESCE(height_in, NULLIF(dimensions->>'height_in','')::numeric, NULLIF(dimensions->>'height','')::numeric)
WHERE dimensions IS NOT NULL
  AND (length_in IS NULL OR width_in IS NULL OR height_in IS NULL)
  AND (COALESCE(status,'') <> 'active' OR COALESCE(weight_oz,0) > 0);