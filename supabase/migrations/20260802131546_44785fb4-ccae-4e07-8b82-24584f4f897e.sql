CREATE OR REPLACE FUNCTION public.dd_margin_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_floor numeric := public.dd_margin_floor();
  v_cost  integer := COALESCE(NEW.supplier_cost_cents, ROUND(COALESCE(NEW.supplier_cost,0)*100)::int);
  v_store integer := NEW.store_price_cents;
  v_dtc   integer := NEW.retail_price_cents;
  m_store numeric;
  m_dtc   numeric;
BEGIN
  IF NEW.supplier_cost_cents IS NULL AND NEW.supplier_cost IS NOT NULL THEN
    NEW.supplier_cost_cents := ROUND(NEW.supplier_cost*100)::int; v_cost := NEW.supplier_cost_cents;
  END IF;
  IF NEW.store_price_cents IS NULL THEN
    NEW.store_price_cents := ROUND(COALESCE(NULLIF(NEW.store_price_a,0), NULLIF(NEW.store_price,0), 0)*100)::int; v_store := NEW.store_price_cents;
  END IF;
  IF NEW.retail_price_cents IS NULL THEN
    NEW.retail_price_cents := ROUND(COALESCE(NULLIF(NEW.dtc_price_b,0), NULLIF(NEW.retail_price,0), 0)*100)::int; v_dtc := NEW.retail_price_cents;
  END IF;

  IF NEW.status IS DISTINCT FROM 'active' OR COALESCE(v_cost,0) <= 0 THEN
    RETURN NEW;
  END IF;

  m_store := public.dd_margin_pct(NULLIF(v_store,0), v_cost);
  m_dtc   := public.dd_margin_pct(NULLIF(v_dtc,0),   v_cost);

  IF m_store IS NULL AND m_dtc IS NULL THEN
    RAISE EXCEPTION 'MARGIN GUARD: cannot publish "%" — supplier cost is set but no B2B or D2C price is configured', NEW.product_name
      USING ERRCODE = 'check_violation';
  END IF;

  IF m_store IS NOT NULL AND m_store < v_floor THEN
    RAISE EXCEPTION 'MARGIN GUARD: cannot publish "%" — B2B margin %%% is below the % %% floor (cost $%, price $%)',
      NEW.product_name, ROUND(m_store*100,2), ROUND(v_floor*100,0), ROUND(v_cost/100.0,2), ROUND(v_store/100.0,2)
      USING ERRCODE = 'check_violation';
  END IF;

  IF m_dtc IS NOT NULL AND m_dtc < v_floor THEN
    RAISE EXCEPTION 'MARGIN GUARD: cannot publish "%" — D2C margin % %% is below the % %% floor (cost $%, price $%)',
      NEW.product_name, ROUND(m_dtc*100,2), ROUND(v_floor*100,0), ROUND(v_cost/100.0,2), ROUND(v_dtc/100.0,2)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;