-- =========================================================
-- 1. PRODUCT ECONOMICS COLUMNS (products_all = canonical DD catalog)
-- =========================================================
ALTER TABLE public.products_all
  ADD COLUMN IF NOT EXISTS supplier_cost_cents integer,
  ADD COLUMN IF NOT EXISTS store_price_cents   integer,
  ADD COLUMN IF NOT EXISTS retail_price_cents  integer,
  ADD COLUMN IF NOT EXISTS supplier_ships      boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_all_supplier_id_fkey'
  ) THEN
    UPDATE public.products_all p SET supplier_id = NULL
     WHERE supplier_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.id = p.supplier_id);
    ALTER TABLE public.products_all
      ADD CONSTRAINT products_all_supplier_id_fkey
      FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill cents columns from legacy numeric columns
UPDATE public.products_all SET
  supplier_cost_cents = COALESCE(supplier_cost_cents, ROUND(COALESCE(supplier_cost,0)*100)::int),
  store_price_cents   = COALESCE(store_price_cents,   ROUND(COALESCE(NULLIF(store_price_a,0), NULLIF(store_price,0), 0)*100)::int),
  retail_price_cents  = COALESCE(retail_price_cents,  ROUND(COALESCE(NULLIF(dtc_price_b,0), NULLIF(retail_price,0), 0)*100)::int);

-- =========================================================
-- 2. SUPPLIER COST HISTORY
-- =========================================================
CREATE TABLE IF NOT EXISTS public.supplier_cost_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products_all(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  old_cost_cents integer,
  new_cost_cents integer,
  delta_cents integer GENERATED ALWAYS AS (COALESCE(new_cost_cents,0) - COALESCE(old_cost_cents,0)) STORED,
  reason text,
  source text NOT NULL DEFAULT 'manual',
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_cost_history_product ON public.supplier_cost_history(product_id, created_at DESC);

GRANT SELECT, INSERT ON public.supplier_cost_history TO authenticated;
GRANT ALL ON public.supplier_cost_history TO service_role;
ALTER TABLE public.supplier_cost_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance and admins read supplier cost history" ON public.supplier_cost_history;
CREATE POLICY "Finance and admins read supplier cost history"
  ON public.supplier_cost_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_finance_access(auth.uid()));

DROP POLICY IF EXISTS "Admins write supplier cost history" ON public.supplier_cost_history;
CREATE POLICY "Admins write supplier cost history"
  ON public.supplier_cost_history FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_finance_access(auth.uid()));

-- =========================================================
-- 3. MARGIN MATH + THRESHOLDS
-- =========================================================
-- FLOOR 0.23 (hard block) | WARN < 0.30 | TARGET B2B 0.31 / D2C 0.50
CREATE OR REPLACE FUNCTION public.dd_margin_pct(p_price_cents integer, p_cost_cents integer)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_price_cents IS NULL OR p_price_cents <= 0 THEN NULL
    ELSE ROUND((p_price_cents - COALESCE(p_cost_cents,0))::numeric / p_price_cents, 4)
  END
$$;

CREATE OR REPLACE FUNCTION public.dd_margin_floor()  RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT 0.23::numeric $$;
CREATE OR REPLACE FUNCTION public.dd_margin_warn()   RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT 0.30::numeric $$;
CREATE OR REPLACE FUNCTION public.dd_target_b2b()    RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT 0.31::numeric $$;
CREATE OR REPLACE FUNCTION public.dd_target_d2c()    RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT 0.50::numeric $$;

-- =========================================================
-- 4. MARGIN ALERTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.dd_margin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products_all(id) ON DELETE CASCADE,
  supplier_id uuid,
  alert_type text NOT NULL,              -- floor_breach_autodeactivated | warn_margin | publish_blocked
  severity text NOT NULL DEFAULT 'critical',
  channel text,                          -- b2b | d2c
  supplier_cost_cents integer,
  price_cents integer,
  margin_pct numeric,
  message text NOT NULL,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dd_margin_alerts_open ON public.dd_margin_alerts(created_at DESC) WHERE acknowledged_at IS NULL;

GRANT SELECT, UPDATE ON public.dd_margin_alerts TO authenticated;
GRANT ALL ON public.dd_margin_alerts TO service_role;
ALTER TABLE public.dd_margin_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read margin alerts" ON public.dd_margin_alerts;
CREATE POLICY "Staff read margin alerts" ON public.dd_margin_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_finance_access(auth.uid()));
DROP POLICY IF EXISTS "Staff ack margin alerts" ON public.dd_margin_alerts;
CREATE POLICY "Staff ack margin alerts" ON public.dd_margin_alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_finance_access(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_finance_access(auth.uid()));

-- =========================================================
-- 5. MARGIN GUARD TRIGGER — hard block publish/activate below floor
-- =========================================================
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
  -- keep cents columns coherent with legacy numeric columns
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
    RAISE EXCEPTION 'MARGIN GUARD: cannot publish "%" — B2B margin %.2f%% is below the %.0f%% floor (cost $%, price $%)',
      NEW.product_name, m_store*100, v_floor*100, v_cost/100.0, v_store/100.0
      USING ERRCODE = 'check_violation';
  END IF;

  IF m_dtc IS NOT NULL AND m_dtc < v_floor THEN
    RAISE EXCEPTION 'MARGIN GUARD: cannot publish "%" — D2C margin %.2f%% is below the %.0f%% floor (cost $%, price $%)',
      NEW.product_name, m_dtc*100, v_floor*100, v_cost/100.0, v_dtc/100.0
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dd_margin_guard ON public.products_all;
CREATE TRIGGER trg_dd_margin_guard
  BEFORE INSERT OR UPDATE ON public.products_all
  FOR EACH ROW EXECUTE FUNCTION public.dd_margin_guard();

-- =========================================================
-- 6. SUPPLIER COST CHANGE LOGGER
-- =========================================================
CREATE OR REPLACE FUNCTION public.dd_log_supplier_cost_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(NEW.supplier_cost_cents,-1) IS DISTINCT FROM COALESCE(OLD.supplier_cost_cents,-1) THEN
    INSERT INTO public.supplier_cost_history(product_id, supplier_id, old_cost_cents, new_cost_cents, changed_by, source)
    VALUES (NEW.id, NEW.supplier_id, OLD.supplier_cost_cents, NEW.supplier_cost_cents, auth.uid(),
            CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'manual' END);
  ELSIF TG_OP = 'INSERT' AND COALESCE(NEW.supplier_cost_cents,0) > 0 THEN
    INSERT INTO public.supplier_cost_history(product_id, supplier_id, old_cost_cents, new_cost_cents, changed_by, source)
    VALUES (NEW.id, NEW.supplier_id, NULL, NEW.supplier_cost_cents, auth.uid(), 'initial');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dd_log_supplier_cost_change ON public.products_all;
CREATE TRIGGER trg_dd_log_supplier_cost_change
  AFTER INSERT OR UPDATE OF supplier_cost_cents ON public.products_all
  FOR EACH ROW EXECUTE FUNCTION public.dd_log_supplier_cost_change();

-- =========================================================
-- 7. NIGHTLY MARGIN SWEEP
-- =========================================================
CREATE OR REPLACE FUNCTION public.dd_margin_nightly_sweep()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_floor numeric := public.dd_margin_floor();
  v_warn  numeric := public.dd_margin_warn();
  v_deact int := 0; v_warned int := 0; v_checked int := 0;
  m_store numeric; m_dtc numeric; worst numeric; worst_channel text; worst_price int;
BEGIN
  FOR r IN
    SELECT id, product_name, supplier_id, supplier_cost_cents, store_price_cents, retail_price_cents
      FROM public.products_all
     WHERE status = 'active' AND COALESCE(supplier_cost_cents,0) > 0
  LOOP
    v_checked := v_checked + 1;
    m_store := public.dd_margin_pct(NULLIF(r.store_price_cents,0), r.supplier_cost_cents);
    m_dtc   := public.dd_margin_pct(NULLIF(r.retail_price_cents,0), r.supplier_cost_cents);

    worst := LEAST(COALESCE(m_store, 9), COALESCE(m_dtc, 9));
    IF worst = COALESCE(m_store, 9) THEN worst_channel := 'b2b'; worst_price := r.store_price_cents;
    ELSE worst_channel := 'd2c'; worst_price := r.retail_price_cents; END IF;

    IF worst < v_floor THEN
      UPDATE public.products_all SET status = 'inactive', updated_at = now() WHERE id = r.id;
      INSERT INTO public.dd_margin_alerts(product_id, supplier_id, alert_type, severity, channel,
        supplier_cost_cents, price_cents, margin_pct, message)
      VALUES (r.id, r.supplier_id, 'floor_breach_autodeactivated', 'critical', worst_channel,
        r.supplier_cost_cents, worst_price, worst,
        format('AUTO-DEACTIVATED: "%s" %s margin fell to %s%% (floor %s%%) after supplier cost change. Cost $%s vs price $%s.',
          r.product_name, upper(worst_channel), ROUND(worst*100,2), ROUND(v_floor*100,0),
          ROUND(r.supplier_cost_cents/100.0,2), ROUND(worst_price/100.0,2)));
      v_deact := v_deact + 1;
    ELSIF worst < v_warn THEN
      INSERT INTO public.dd_margin_alerts(product_id, supplier_id, alert_type, severity, channel,
        supplier_cost_cents, price_cents, margin_pct, message)
      SELECT r.id, r.supplier_id, 'warn_margin', 'warn', worst_channel,
        r.supplier_cost_cents, worst_price, worst,
        format('REVIEW: "%s" %s margin is %s%% (below %s%% warn threshold).',
          r.product_name, upper(worst_channel), ROUND(worst*100,2), ROUND(v_warn*100,0))
      WHERE NOT EXISTS (
        SELECT 1 FROM public.dd_margin_alerts a
         WHERE a.product_id = r.id AND a.alert_type = 'warn_margin'
           AND a.acknowledged_at IS NULL AND a.created_at > now() - interval '7 days');
      v_warned := v_warned + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('checked', v_checked, 'deactivated', v_deact, 'warned', v_warned, 'ran_at', now());
END $$;

REVOKE ALL ON FUNCTION public.dd_margin_nightly_sweep() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.dd_margin_nightly_sweep() TO authenticated, service_role;

-- =========================================================
-- 8. COST CONFIDENTIALITY — enforced, not hidden
-- =========================================================
-- Remove the blanket public read that exposed supplier_cost to anon
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products_all;

REVOKE ALL ON public.products_all FROM anon;

-- Public/storefront surface: no cost, no margin, no supplier columns at all.
DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public AS
  SELECT id, wholesaler_id, brand_id, brand, brand_visible, product_name, description,
         ai_description, ai_description_short, seo_title, seo_keywords, key_features,
         images, image_urls, primary_image_url, category, item_type, package_text,
         flavor_or_variant, size_or_count, unit_type, inventory_qty, low_stock_threshold,
         track_inventory, min_order_qty, case_qty, units_per_case, has_variants, variant_types,
         weight_oz, length_in, width_in, height_in, is_fragile, stackable,
         shipping_from_city, shipping_from_state, processing_time,
         review_count, avg_rating, is_age_restricted, requires_pact_act, geo_blocked_states,
         status, created_at, updated_at,
         retail_price, store_price, street_price, case_price_store, map_price,
         retail_price_cents, store_price_cents,
         recognition
    FROM public.products_all
   WHERE status = 'active';

GRANT SELECT ON public.products_public TO anon, authenticated;

-- Privileged read of the full row (incl. cost) stays on products_all behind RLS
DROP POLICY IF EXISTS "Staff read full product economics" ON public.products_all;
CREATE POLICY "Staff read full product economics"
  ON public.products_all FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_finance_access(auth.uid())
    OR EXISTS (SELECT 1 FROM public.wholesaler_profiles wp
                WHERE wp.id = products_all.wholesaler_id AND wp.user_id = auth.uid())
  );