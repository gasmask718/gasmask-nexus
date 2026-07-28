CREATE OR REPLACE FUNCTION public.auto_flag_low_stock_needs_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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

  -- On INSERT, a brand-new SKU row is often created purely to record a flag
  -- toggle (e.g. "bring samples") and carries the default count of 0.
  -- Never auto-flag those: require a real inventory count on the insert.
  IF TG_OP = 'INSERT' AND NEW.last_inventory_check_at IS NULL THEN
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
$function$;