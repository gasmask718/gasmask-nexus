-- A1: products.tube_count generated alias
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tube_count integer
  GENERATED ALWAYS AS (units_per_box) STORED;

-- A2: extend store_status enum (additive)
ALTER TYPE public.store_status ADD VALUE IF NOT EXISTS 'contacted';
ALTER TYPE public.store_status ADD VALUE IF NOT EXISTS 'sample_sent';
ALTER TYPE public.store_status ADD VALUE IF NOT EXISTS 'visited';
ALTER TYPE public.store_status ADD VALUE IF NOT EXISTS 'demo_scheduled';
ALTER TYPE public.store_status ADD VALUE IF NOT EXISTS 'revenue_active';
ALTER TYPE public.store_status ADD VALUE IF NOT EXISTS 'engagement_active';
ALTER TYPE public.store_status ADD VALUE IF NOT EXISTS 'dormant';
ALTER TYPE public.store_status ADD VALUE IF NOT EXISTS 'lost';
ALTER TYPE public.store_status ADD VALUE IF NOT EXISTS 'dead';

-- A3: stores lifecycle/territory fields
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS assigned_ambassador_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS outreach_notes text,
  ADD COLUMN IF NOT EXISTS last_classified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_stores_assigned_ambassador
  ON public.stores(assigned_ambassador_id)
  WHERE assigned_ambassador_id IS NOT NULL;

-- A4: neighborhood_zip_lookup
CREATE TABLE IF NOT EXISTS public.neighborhood_zip_lookup (
  zip_code     text PRIMARY KEY,
  neighborhood text NOT NULL,
  boro         text,
  city         text,
  state        text DEFAULT 'NY',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nz_lookup_boro_neighborhood
  ON public.neighborhood_zip_lookup (boro, neighborhood);

ALTER TABLE public.neighborhood_zip_lookup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read neighborhood_zip_lookup" ON public.neighborhood_zip_lookup;
CREATE POLICY "Authenticated can read neighborhood_zip_lookup"
  ON public.neighborhood_zip_lookup
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage neighborhood_zip_lookup" ON public.neighborhood_zip_lookup;
CREATE POLICY "Admins manage neighborhood_zip_lookup"
  ON public.neighborhood_zip_lookup
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- A5: v_store_tube_summary rollup view
DROP VIEW IF EXISTS public.v_store_tube_summary;
CREATE VIEW public.v_store_tube_summary AS
WITH on_hand AS (
  SELECT store_id, SUM(tubes_on_hand)::numeric AS total_on_hand
  FROM public.v_store_tubes_on_hand
  GROUP BY store_id
),
ledger_agg AS (
  SELECT
    store_id,
    SUM(tubes_delta)                                                                 AS lifetime,
    SUM(tubes_delta) FILTER (WHERE created_at >= now() - interval '30 days')         AS d30,
    SUM(tubes_delta) FILTER (WHERE created_at >= now() - interval '90 days')         AS d90,
    SUM(tubes_delta) FILTER (WHERE created_at >= date_trunc('month', now()))         AS mtd,
    MAX(created_at)                                                                  AS last_tx
  FROM public.tube_sale_ledger
  GROUP BY store_id
),
top_brand AS (
  SELECT DISTINCT ON (store_id)
    store_id, brand
  FROM (
    SELECT store_id, brand, SUM(tubes_delta) AS s
    FROM public.tube_sale_ledger
    WHERE brand IS NOT NULL
    GROUP BY store_id, brand
  ) x
  ORDER BY store_id, s DESC
)
SELECT
  s.id                                       AS store_id,
  s.name                                     AS store_name,
  s.neighborhood,
  s.boro,
  s.address_zip,
  s.status,
  s.assigned_ambassador_id,
  COALESCE(la.lifetime, 0)                   AS lifetime_tubes_delivered,
  COALESCE(oh.total_on_hand, 0)              AS current_inventory_count,
  GREATEST(COALESCE(la.lifetime, 0) - COALESCE(oh.total_on_hand, 0), 0) AS tubes_sold_estimate,
  COALESCE(la.d30, 0)                        AS tubes_last_30_days,
  COALESCE(la.mtd, 0)                        AS tubes_this_month,
  COALESCE(la.d90, 0)                        AS tubes_last_90_days,
  tb.brand                                   AS top_brand,
  CASE
    WHEN COALESCE(oh.total_on_hand, 0) = 0   THEN 'out_of_stock'
    WHEN COALESCE(oh.total_on_hand, 0) < 50  THEN 'restock_now'
    WHEN COALESCE(oh.total_on_hand, 0) < 200 THEN 'restock_soon'
    ELSE 'stocked'
  END                                        AS restock_status,
  la.last_tx                                 AS last_tube_transaction_at
FROM public.stores s
LEFT JOIN ledger_agg la ON la.store_id = s.id
LEFT JOIN on_hand    oh ON oh.store_id = s.id
LEFT JOIN top_brand  tb ON tb.store_id = s.id
WHERE s.deleted_at IS NULL;

GRANT SELECT ON public.v_store_tube_summary TO authenticated, anon;