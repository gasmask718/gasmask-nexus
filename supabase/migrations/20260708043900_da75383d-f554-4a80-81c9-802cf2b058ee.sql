
CREATE OR REPLACE FUNCTION public.dd_enforce_price_floor()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  allow_override text;
  cost numeric;
  min_store numeric;
  min_dtc numeric;
  new_store numeric;
  new_dtc numeric;
  store_margin numeric;
  dtc_margin numeric;
BEGIN
  -- Allow explicit override via transaction-local setting
  BEGIN
    allow_override := current_setting('app.allow_below_floor', true);
  EXCEPTION WHEN OTHERS THEN
    allow_override := NULL;
  END;
  IF allow_override = 'true' THEN
    RETURN NEW;
  END IF;

  -- Only guard when store_price_a or dtc_price_b actually changed
  IF NEW.store_price_a IS NOT DISTINCT FROM OLD.store_price_a
     AND NEW.dtc_price_b IS NOT DISTINCT FROM OLD.dtc_price_b THEN
    RETURN NEW;
  END IF;

  cost := NEW.supplier_cost;
  IF cost IS NULL OR cost <= 0 THEN
    RETURN NEW;
  END IF;

  min_store := NEW.min_store_margin_pct;
  min_dtc   := NEW.min_dtc_margin_pct;
  new_store := NEW.store_price_a;
  new_dtc   := NEW.dtc_price_b;

  IF new_store IS NOT NULL AND min_store IS NOT NULL AND new_store > 0 THEN
    store_margin := ((new_store - cost) / new_store) * 100.0;
    IF store_margin < min_store THEN
      RAISE EXCEPTION 'Store price % breaches floor: margin %.2f%% < min %.2f%% (cost %)',
        new_store, store_margin, min_store, cost
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF new_dtc IS NOT NULL AND min_dtc IS NOT NULL AND new_dtc > 0 THEN
    dtc_margin := ((new_dtc - cost) / new_dtc) * 100.0;
    IF dtc_margin < min_dtc THEN
      RAISE EXCEPTION 'DTC price % breaches floor: margin %.2f%% < min %.2f%% (cost %)',
        new_dtc, dtc_margin, min_dtc, cost
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dd_enforce_price_floor ON public.products_all;
CREATE TRIGGER trg_dd_enforce_price_floor
  BEFORE UPDATE ON public.products_all
  FOR EACH ROW
  EXECUTE FUNCTION public.dd_enforce_price_floor();
