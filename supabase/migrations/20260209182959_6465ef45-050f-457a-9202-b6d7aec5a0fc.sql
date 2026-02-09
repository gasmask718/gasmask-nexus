
-- =====================================================
-- AMBASSADOR PROFIT TRUTH HARDENING v1
-- A) Cost Basis (WAC) + Backfill RPC
-- B) Attribution Window Correctness
-- C) RLS via Security-Barrier Functions
-- D) Confidence Scoring
-- =====================================================

-- =====================================================
-- A) BACKFILL RPC: Weighted Average Cost
-- Computes WAC from ambassador_purchase_items for a given ambassador+product
-- then fills missing cost_per_unit_at_sale on invoice_line_items
-- =====================================================

CREATE OR REPLACE FUNCTION public.compute_ambassador_wac(
  p_ambassador_id uuid,
  p_product_name text,
  p_as_of timestamptz DEFAULT now()
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT SUM(api.unit_price_snapshot * api.quantity) / NULLIF(SUM(api.quantity), 0)
      FROM ambassador_purchase_items api
      JOIN ambassador_purchases ap ON ap.id = api.purchase_id
      WHERE ap.ambassador_id = p_ambassador_id
        AND LOWER(api.product_name_snapshot) = LOWER(p_product_name)
        AND ap.created_at <= p_as_of
        AND ap.status IN ('completed', 'fulfilled', 'paid')
    ),
    0
  );
$$;

-- Backfill RPC: fills missing cost_per_unit_at_sale using WAC
CREATE OR REPLACE FUNCTION public.backfill_invoice_line_item_costs(
  p_from_date timestamptz DEFAULT '2000-01-01',
  p_to_date timestamptz DEFAULT now()
)
RETURNS TABLE(updated_count int, skipped_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int := 0;
  v_skipped int := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT ili.id AS line_item_id,
           aa.ambassador_id,
           ili.product_name,
           i.created_at AS invoice_date
    FROM invoice_line_items ili
    JOIN invoices i ON i.id = ili.invoice_id
    JOIN ambassador_assignments aa ON aa.store_id = i.store_id
      AND aa.active = true
      AND i.created_at >= COALESCE(aa.start_date::timestamptz, aa.created_at)
      AND i.created_at <= COALESCE(aa.unassigned_at, aa.end_date::timestamptz + interval '1 day', now())
    WHERE i.created_at BETWEEN p_from_date AND p_to_date
      AND (ili.cost_per_unit_at_sale IS NULL OR ili.cost_per_unit_at_sale = 0)
      AND ili.product_name IS NOT NULL
  LOOP
    DECLARE
      v_wac numeric;
    BEGIN
      v_wac := compute_ambassador_wac(rec.ambassador_id, rec.product_name, rec.invoice_date);
      IF v_wac > 0 THEN
        UPDATE invoice_line_items
        SET cost_per_unit_at_sale = v_wac,
            profit_at_sale = (unit_price * quantity) - (v_wac * quantity)
        WHERE id = rec.line_item_id;
        v_updated := v_updated + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    END;
  END LOOP;

  RETURN QUERY SELECT v_updated, v_skipped;
END;
$$;

-- =====================================================
-- B) UPDATED VIEWS: Time-windowed attribution + confidence
-- =====================================================

-- Drop existing views
DROP VIEW IF EXISTS v_ambassador_profit_breakdown CASCADE;
DROP VIEW IF EXISTS v_ambassador_profit_dashboard CASCADE;

-- Recreate breakdown with windowed attribution + confidence fields
CREATE OR REPLACE VIEW v_ambassador_profit_breakdown
WITH (security_barrier = true)
AS
SELECT
  aa.ambassador_id,
  a.user_id AS ambassador_user_id,
  ili.brand,
  ili.brand_id,
  ili.product_name,
  ili.product_id,
  ili.sale_channel,
  i.store_id,
  sm.store_name,
  SUM(ili.quantity) AS units_sold,
  SUM(ili.cost_per_unit_at_sale * ili.quantity) AS wholesale_cost,
  SUM(ili.total) AS retail_revenue,
  SUM(ili.profit_at_sale) AS net_profit,
  ROUND(
    CASE WHEN COALESCE(SUM(ili.total), 0) > 0
      THEN (COALESCE(SUM(ili.profit_at_sale), 0) / SUM(ili.total)) * 100
      ELSE 0
    END, 2
  ) AS margin_pct,
  MIN(i.created_at) AS first_sale_at,
  MAX(i.created_at) AS last_sale_at,
  date_trunc('month', i.created_at) AS sale_month,
  -- Attribution fields
  'windowed_assignment'::text AS attribution_method,
  bool_and(
    i.created_at >= COALESCE(aa.start_date::timestamptz, aa.created_at)
    AND i.created_at <= COALESCE(aa.unassigned_at, aa.end_date::timestamptz + interval '1 day', now())
  ) AS attribution_valid,
  -- Confidence fields
  CASE
    WHEN bool_and(ili.cost_per_unit_at_sale IS NOT NULL AND ili.cost_per_unit_at_sale > 0)
      AND bool_and(
        i.created_at >= COALESCE(aa.start_date::timestamptz, aa.created_at)
        AND i.created_at <= COALESCE(aa.unassigned_at, aa.end_date::timestamptz + interval '1 day', now())
      )
    THEN 100
    WHEN bool_and(ili.cost_per_unit_at_sale IS NOT NULL AND ili.cost_per_unit_at_sale > 0)
    THEN 70
    WHEN bool_and(
      i.created_at >= COALESCE(aa.start_date::timestamptz, aa.created_at)
      AND i.created_at <= COALESCE(aa.unassigned_at, aa.end_date::timestamptz + interval '1 day', now())
    )
    THEN 50
    ELSE 30
  END AS profit_confidence_score,
  CASE
    WHEN bool_and(ili.cost_per_unit_at_sale IS NOT NULL AND ili.cost_per_unit_at_sale > 0)
      AND bool_and(
        i.created_at >= COALESCE(aa.start_date::timestamptz, aa.created_at)
        AND i.created_at <= COALESCE(aa.unassigned_at, aa.end_date::timestamptz + interval '1 day', now())
      )
    THEN 'confirmed'
    ELSE 'estimated'
  END AS profit_status
FROM ambassador_assignments aa
JOIN ambassadors a ON a.id = aa.ambassador_id
JOIN invoices i ON i.store_id = aa.store_id
  AND i.created_at >= COALESCE(aa.start_date::timestamptz, aa.created_at)
  AND i.created_at <= COALESCE(aa.unassigned_at, aa.end_date::timestamptz + interval '1 day', now())
JOIN invoice_line_items ili ON ili.invoice_id = i.id
LEFT JOIN store_master sm ON sm.id = i.store_id
WHERE aa.store_id IS NOT NULL
GROUP BY
  aa.ambassador_id,
  a.user_id,
  ili.brand,
  ili.brand_id,
  ili.product_name,
  ili.product_id,
  ili.sale_channel,
  i.store_id,
  sm.store_name,
  date_trunc('month', i.created_at);

-- Recreate dashboard summary from breakdown
CREATE OR REPLACE VIEW v_ambassador_profit_dashboard
WITH (security_barrier = true)
AS
SELECT
  b.ambassador_id,
  b.ambassador_user_id,
  p.name AS ambassador_name,
  COUNT(DISTINCT b.sale_month) AS total_invoices,
  COALESCE(SUM(b.units_sold), 0) AS total_units_sold,
  COALESCE(SUM(b.retail_revenue), 0) AS total_revenue,
  COALESCE(SUM(b.wholesale_cost), 0) AS total_wholesale_cost,
  COALESCE(SUM(b.net_profit), 0) AS total_profit,
  ROUND(
    CASE WHEN COALESCE(SUM(b.retail_revenue), 0) > 0
      THEN (COALESCE(SUM(b.net_profit), 0) / SUM(b.retail_revenue)) * 100
      ELSE 0
    END, 2
  ) AS avg_margin_pct,
  COUNT(DISTINCT b.brand) AS brands_sold,
  COUNT(DISTINCT b.product_name) AS products_sold,
  COUNT(DISTINCT b.store_id) AS stores_served,
  -- Aggregate confidence
  ROUND(AVG(b.profit_confidence_score), 0) AS avg_confidence_score,
  COUNT(*) FILTER (WHERE b.profit_status = 'estimated') AS estimated_row_count,
  COUNT(*) FILTER (WHERE b.profit_status = 'confirmed') AS confirmed_row_count
FROM v_ambassador_profit_breakdown b
LEFT JOIN profiles p ON p.id = b.ambassador_user_id
GROUP BY b.ambassador_id, b.ambassador_user_id, p.name;

-- =====================================================
-- C) RLS: Create secure accessor functions
-- Views with security_barrier + underlying table RLS handle ambassador scoping.
-- But we also add explicit helper to query only own data.
-- =====================================================

-- Function for ambassadors to get ONLY their profit breakdown
CREATE OR REPLACE FUNCTION public.get_my_profit_breakdown(
  p_brand text DEFAULT NULL,
  p_store_id uuid DEFAULT NULL,
  p_sale_channel text DEFAULT NULL
)
RETURNS SETOF v_ambassador_profit_breakdown
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM v_ambassador_profit_breakdown
  WHERE ambassador_user_id = auth.uid()
    AND (p_brand IS NULL OR brand = p_brand)
    AND (p_store_id IS NULL OR store_id = p_store_id)
    AND (p_sale_channel IS NULL OR sale_channel = p_sale_channel)
  ORDER BY sale_month DESC;
$$;

-- Function for ambassadors to get ONLY their profit dashboard
CREATE OR REPLACE FUNCTION public.get_my_profit_dashboard()
RETURNS SETOF v_ambassador_profit_dashboard
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM v_ambassador_profit_dashboard
  WHERE ambassador_user_id = auth.uid();
$$;

-- =====================================================
-- D) INDEXES for performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_ambassador_assignments_store_dates
  ON ambassador_assignments (store_id, start_date, end_date, unassigned_at)
  WHERE store_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_store_created
  ON invoices (store_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ambassador_purchases_ambassador_status
  ON ambassador_purchases (ambassador_id, status, created_at);
