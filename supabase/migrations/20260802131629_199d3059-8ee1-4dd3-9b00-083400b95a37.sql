CREATE OR REPLACE FUNCTION public.dd_margin_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_floor numeric := public.dd_margin_floor();
  v_cost  integer;
  v_store integer;
  v_dtc   integer;
  m_store numeric;
  m_dtc   numeric;
  v_activating boolean;
BEGIN
  IF NEW.supplier_cost_cents IS NULL AND NEW.supplier_cost IS NOT NULL THEN
    NEW.supplier_cost_cents := ROUND(NEW.supplier_cost*100)::int;
  END IF;
  IF NEW.store_price_cents IS NULL THEN
    NEW.store_price_cents := ROUND(COALESCE(NULLIF(NEW.store_price_a,0), NULLIF(NEW.store_price,0), 0)*100)::int;
  END IF;
  IF NEW.retail_price_cents IS NULL THEN
    NEW.retail_price_cents := ROUND(COALESCE(NULLIF(NEW.dtc_price_b,0), NULLIF(NEW.retail_price,0), 0)*100)::int;
  END IF;

  v_cost  := COALESCE(NEW.supplier_cost_cents, 0);
  v_store := NEW.store_price_cents;
  v_dtc   := NEW.retail_price_cents;

  -- Guard the act of publishing/activating, and any price edit while live.
  v_activating := NEW.status = 'active' AND (
       TG_OP = 'INSERT'
    OR OLD.status IS DISTINCT FROM 'active'
    OR NEW.store_price_cents IS DISTINCT FROM OLD.store_price_cents
    OR NEW.retail_price_cents IS DISTINCT FROM OLD.retail_price_cents
  );

  IF NOT v_activating OR v_cost <= 0 THEN
    RETURN NEW;
  END IF;

  m_store := public.dd_margin_pct(NULLIF(v_store,0), v_cost);
  m_dtc   := public.dd_margin_pct(NULLIF(v_dtc,0),   v_cost);

  IF m_store IS NULL AND m_dtc IS NULL THEN
    RAISE EXCEPTION 'MARGIN GUARD: cannot publish "%" - supplier cost is set but no B2B or D2C price is configured', NEW.product_name
      USING ERRCODE = 'check_violation';
  END IF;

  IF m_store IS NOT NULL AND m_store < v_floor THEN
    RAISE EXCEPTION '%', format(
      'MARGIN GUARD: cannot publish "%s" - B2B margin %s%% is below the %s%% floor (cost $%s, price $%s)',
      NEW.product_name, ROUND(m_store*100,2), ROUND(v_floor*100,0), ROUND(v_cost/100.0,2), ROUND(v_store/100.0,2))
      USING ERRCODE = 'check_violation';
  END IF;

  IF m_dtc IS NOT NULL AND m_dtc < v_floor THEN
    RAISE EXCEPTION '%', format(
      'MARGIN GUARD: cannot publish "%s" - D2C margin %s%% is below the %s%% floor (cost $%s, price $%s)',
      NEW.product_name, ROUND(m_dtc*100,2), ROUND(v_floor*100,0), ROUND(v_cost/100.0,2), ROUND(v_dtc/100.0,2))
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;