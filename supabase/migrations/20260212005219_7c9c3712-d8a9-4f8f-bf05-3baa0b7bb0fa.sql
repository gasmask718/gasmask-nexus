-- Phase 3A.1: Add pack columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pack_size integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS packs_per_box integer;

COMMENT ON COLUMN public.products.pack_size IS
'Units per pack. Canonical units: bags/tubes depending on track_by. Default 1 = not a pack.';

COMMENT ON COLUMN public.products.packs_per_box IS
'How many packs are bundled into a box for sales/logistics. Nullable if not boxed.';

-- Phase 3A.2: Add snapshot columns + extend sale_unit constraint on invoice_line_items
ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS pack_size_snapshot integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS packs_per_box_snapshot integer;

-- Extend sale_unit CHECK to include 'pack'
ALTER TABLE public.invoice_line_items
  DROP CONSTRAINT IF EXISTS invoice_line_items_sale_unit_check;

ALTER TABLE public.invoice_line_items
  ADD CONSTRAINT invoice_line_items_sale_unit_check
  CHECK (sale_unit = ANY (ARRAY['box','unit','pack']));

-- Phase 3B: Product validation trigger for pack fields
CREATE OR REPLACE FUNCTION public.validate_product_pack_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pack_size < 1 THEN
    RAISE EXCEPTION 'pack_size must be >= 1';
  END IF;

  IF NEW.packs_per_box IS NOT NULL AND NEW.packs_per_box <= 0 THEN
    RAISE EXCEPTION 'packs_per_box must be > 0 when set';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_product_packs ON public.products;
CREATE TRIGGER trg_validate_product_packs
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_product_pack_fields();

-- Phase 3C: Update sync trigger to compute canonical units from sale_unit + pack snapshots
CREATE OR REPLACE FUNCTION sync_computed_units()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_pack_size integer;
  v_ppb integer;
  v_qty numeric;
  v_computed numeric;
BEGIN
  v_pack_size := COALESCE(NEW.pack_size_snapshot, 1);
  v_ppb := NEW.packs_per_box_snapshot;
  v_qty := COALESCE(NEW.quantity, 0);

  -- Compute canonical units based on sale_unit
  CASE NEW.sale_unit
    WHEN 'unit' THEN
      v_computed := v_qty;
    WHEN 'pack' THEN
      v_computed := v_qty * v_pack_size;
    WHEN 'box' THEN
      IF v_ppb IS NOT NULL AND v_ppb > 0 THEN
        -- New pack-aware path: boxes * packs_per_box * pack_size
        v_computed := v_qty * v_ppb * v_pack_size;
      ELSE
        -- Legacy path: use units_per_box from the line item
        v_computed := v_qty * COALESCE(NEW.units_per_box, 1);
      END IF;
    ELSE
      v_computed := v_qty;
  END CASE;

  -- If caller explicitly set computed_units_total, prefer that (manual override)
  -- Otherwise use computed value
  IF NEW.computed_units_total IS NULL OR
     (TG_OP = 'INSERT') OR
     (NEW.quantity IS DISTINCT FROM OLD.quantity) OR
     (NEW.sale_unit IS DISTINCT FROM OLD.sale_unit) OR
     (NEW.pack_size_snapshot IS DISTINCT FROM OLD.pack_size_snapshot) OR
     (NEW.packs_per_box_snapshot IS DISTINCT FROM OLD.packs_per_box_snapshot) OR
     (NEW.units_per_box IS DISTINCT FROM OLD.units_per_box) THEN
    NEW.computed_units_total := v_computed;
  END IF;

  -- Always mirror to legacy alias
  NEW.computed_tubes_total := NEW.computed_units_total;

  RETURN NEW;
END;
$$;