-- FAST PATCH: Fix product validation trigger for bag packaging
-- Bags can now have units_per_box (packaging count)
-- Tubes still require units_per_box > 0

CREATE OR REPLACE FUNCTION public.validate_product_tracking()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Tubes MUST define packaging count
  IF NEW.track_by = 'tubes' AND (NEW.units_per_box IS NULL OR NEW.units_per_box <= 0) THEN
    RAISE EXCEPTION 'Tube-tracked products must have units_per_box > 0';
  END IF;

  -- Bags MAY define packaging count (bags per box)
  -- No restriction needed — bags can be boxed or loose

  -- Price sanity checks
  IF NEW.price_per_unit IS NOT NULL AND NEW.price_per_unit < 0 THEN
    RAISE EXCEPTION 'price_per_unit must be >= 0';
  END IF;

  IF NEW.price_per_box IS NOT NULL AND NEW.price_per_box < 0 THEN
    RAISE EXCEPTION 'price_per_box must be >= 0';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS trg_validate_product_tracking ON public.products;

CREATE TRIGGER trg_validate_product_tracking
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.validate_product_tracking();