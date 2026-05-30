-- Auto-flag low-stock stores for reorder
-- When current_tubes_left < 15 on a rep-touched row, set needs_order = true.
-- Never auto-clears. Never overrides a rep who just changed needs_order in the same write.

CREATE OR REPLACE FUNCTION public.auto_flag_low_stock_needs_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only act on rep-touched rows (avoids flagging the ~2,800 default-0 untouched rows)
  IF NEW.last_updated_by IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip simulations
  IF COALESCE(NEW.is_simulation, false) = true THEN
    RETURN NEW;
  END IF;

  -- If the rep explicitly changed needs_order in THIS write, respect their choice
  IF TG_OP = 'UPDATE' AND OLD.needs_order IS DISTINCT FROM NEW.needs_order THEN
    RETURN NEW;
  END IF;

  -- Auto-SET true only (never auto-clear)
  IF NEW.current_tubes_left IS NOT NULL
     AND NEW.current_tubes_left < 15
     AND COALESCE(NEW.needs_order, false) = false THEN
    NEW.needs_order := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_flag_low_stock_needs_order ON public.store_tube_inventory_status;
CREATE TRIGGER trg_auto_flag_low_stock_needs_order
BEFORE INSERT OR UPDATE OF current_tubes_left
ON public.store_tube_inventory_status
FOR EACH ROW
EXECUTE FUNCTION public.auto_flag_low_stock_needs_order();