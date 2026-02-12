-- Fix sync trigger: column is units_per_box_snapshot, not units_per_box
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

  CASE NEW.sale_unit
    WHEN 'unit' THEN
      v_computed := v_qty;
    WHEN 'pack' THEN
      v_computed := v_qty * v_pack_size;
    WHEN 'box' THEN
      IF v_ppb IS NOT NULL AND v_ppb > 0 THEN
        v_computed := v_qty * v_ppb * v_pack_size;
      ELSE
        v_computed := v_qty * COALESCE(NEW.units_per_box_snapshot, 1);
      END IF;
    ELSE
      v_computed := v_qty;
  END CASE;

  IF NEW.computed_units_total IS NULL OR
     (TG_OP = 'INSERT') OR
     (NEW.quantity IS DISTINCT FROM OLD.quantity) OR
     (NEW.sale_unit IS DISTINCT FROM OLD.sale_unit) OR
     (NEW.pack_size_snapshot IS DISTINCT FROM OLD.pack_size_snapshot) OR
     (NEW.packs_per_box_snapshot IS DISTINCT FROM OLD.packs_per_box_snapshot) OR
     (NEW.units_per_box_snapshot IS DISTINCT FROM OLD.units_per_box_snapshot) THEN
    NEW.computed_units_total := v_computed;
  END IF;

  NEW.computed_tubes_total := NEW.computed_units_total;

  RETURN NEW;
END;
$$;