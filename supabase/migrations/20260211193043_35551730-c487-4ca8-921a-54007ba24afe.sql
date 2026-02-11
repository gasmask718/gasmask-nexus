
-- =====================================================
-- PHASE A: Store Inventory Snapshot Views (Ledger-Derived)
-- =====================================================

-- A1. Tubes on hand per store per product
CREATE OR REPLACE VIEW public.v_store_tubes_on_hand AS
SELECT
  store_id,
  product_id,
  product_name,
  brand_id,
  SUM(tubes_delta) AS tubes_on_hand
FROM public.tube_sale_ledger
GROUP BY store_id, product_id, product_name, brand_id;

-- A2. Bags on hand per store per product
CREATE OR REPLACE VIEW public.v_store_bags_on_hand AS
SELECT
  store_id,
  product_id,
  product_name,
  brand_id,
  SUM(bags_delta) AS bags_on_hand
FROM public.bag_sale_ledger
GROUP BY store_id, product_id, product_name, brand_id;

-- =====================================================
-- PHASE B: Bag Stock Thresholds & Reorder Alerts
-- =====================================================

-- B1. Bag threshold table
CREATE TABLE IF NOT EXISTS public.bag_stock_thresholds (
  store_id uuid NOT NULL,
  product_id uuid NOT NULL,
  min_quantity integer NOT NULL DEFAULT 10,
  reorder_quantity integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, product_id)
);

ALTER TABLE public.bag_stock_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read bag thresholds"
  ON public.bag_stock_thresholds FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage bag thresholds"
  ON public.bag_stock_thresholds FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Tube threshold table (parallel)
CREATE TABLE IF NOT EXISTS public.tube_stock_thresholds (
  store_id uuid NOT NULL,
  product_id uuid NOT NULL,
  min_quantity integer NOT NULL DEFAULT 20,
  reorder_quantity integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, product_id)
);

ALTER TABLE public.tube_stock_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tube thresholds"
  ON public.tube_stock_thresholds FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage tube thresholds"
  ON public.tube_stock_thresholds FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- B2. Bag reorder alert view
CREATE OR REPLACE VIEW public.v_bag_reorder_alerts AS
SELECT
  b.store_id,
  b.product_id,
  b.product_name,
  b.brand_id,
  b.bags_on_hand,
  t.min_quantity,
  t.reorder_quantity,
  CASE
    WHEN b.bags_on_hand <= 0 THEN 'critical'
    WHEN b.bags_on_hand < t.min_quantity THEN 'low'
    ELSE 'ok'
  END AS alert_level
FROM public.v_store_bags_on_hand b
JOIN public.bag_stock_thresholds t
  ON b.store_id = t.store_id
 AND b.product_id = t.product_id
WHERE b.bags_on_hand < t.min_quantity;

-- Tube reorder alert view (parallel)
CREATE OR REPLACE VIEW public.v_tube_reorder_alerts AS
SELECT
  tb.store_id,
  tb.product_id,
  tb.product_name,
  tb.brand_id,
  tb.tubes_on_hand,
  t.min_quantity,
  t.reorder_quantity,
  CASE
    WHEN tb.tubes_on_hand <= 0 THEN 'critical'
    WHEN tb.tubes_on_hand < t.min_quantity THEN 'low'
    ELSE 'ok'
  END AS alert_level
FROM public.v_store_tubes_on_hand tb
JOIN public.tube_stock_thresholds t
  ON tb.store_id = t.store_id
 AND tb.product_id = t.product_id
WHERE tb.tubes_on_hand < t.min_quantity;

-- =====================================================
-- PHASE C: Tube ↔ Bag Ratio Intelligence
-- =====================================================

CREATE OR REPLACE VIEW public.v_tube_bag_ratio_per_store AS
SELECT
  t.store_id,
  SUM(ABS(t.tubes_delta)) FILTER (WHERE t.source = 'invoice_finalized') AS tubes_sold,
  COALESCE(b.bags_sold, 0) AS bags_sold,
  CASE
    WHEN COALESCE(b.bags_sold, 0) = 0 THEN NULL
    ELSE ROUND(
      SUM(ABS(t.tubes_delta)) FILTER (WHERE t.source = 'invoice_finalized')::numeric
      / b.bags_sold,
      2
    )
  END AS tubes_per_bag_ratio
FROM public.tube_sale_ledger t
LEFT JOIN (
  SELECT store_id, SUM(ABS(bags_delta)) FILTER (WHERE source = 'invoice_finalized') AS bags_sold
  FROM public.bag_sale_ledger
  GROUP BY store_id
) b ON t.store_id = b.store_id
GROUP BY t.store_id, b.bags_sold;

-- =====================================================
-- PHASE D: Historical Invoice Repair Framework
-- =====================================================

ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS repair_status text NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS repair_notes text,
ADD COLUMN IF NOT EXISTS repaired_at timestamptz,
ADD COLUMN IF NOT EXISTS repaired_by text;
