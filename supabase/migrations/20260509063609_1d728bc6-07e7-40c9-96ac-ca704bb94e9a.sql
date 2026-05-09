-- Phase C0: schema additions
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS is_test_data boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.data_quality_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  details jsonb,
  flagged_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by text
);
CREATE INDEX IF NOT EXISTS idx_dqf_entity ON public.data_quality_flags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_dqf_type_unresolved ON public.data_quality_flags(flag_type) WHERE resolved_at IS NULL;

ALTER TABLE public.data_quality_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read data_quality_flags"
  ON public.data_quality_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage data_quality_flags"
  ON public.data_quality_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Recreate v_store_tube_summary excluding test data
CREATE OR REPLACE VIEW public.v_store_tube_summary AS
WITH on_hand AS (
  SELECT v_store_tubes_on_hand.store_id,
         sum(v_store_tubes_on_hand.tubes_on_hand)::numeric AS total_on_hand
    FROM v_store_tubes_on_hand
   GROUP BY v_store_tubes_on_hand.store_id
), ledger_agg AS (
  SELECT tube_sale_ledger.store_id,
         sum(tube_sale_ledger.tubes_delta) AS lifetime,
         sum(tube_sale_ledger.tubes_delta) FILTER (WHERE tube_sale_ledger.created_at >= (now() - '30 days'::interval)) AS d30,
         sum(tube_sale_ledger.tubes_delta) FILTER (WHERE tube_sale_ledger.created_at >= (now() - '90 days'::interval)) AS d90,
         sum(tube_sale_ledger.tubes_delta) FILTER (WHERE tube_sale_ledger.created_at >= date_trunc('month', now())) AS mtd,
         max(tube_sale_ledger.created_at) AS last_tx
    FROM tube_sale_ledger
   GROUP BY tube_sale_ledger.store_id
), top_brand AS (
  SELECT DISTINCT ON (x.store_id) x.store_id, x.brand
    FROM (SELECT tube_sale_ledger.store_id, tube_sale_ledger.brand,
                 sum(tube_sale_ledger.tubes_delta) AS s
            FROM tube_sale_ledger
           WHERE tube_sale_ledger.brand IS NOT NULL
           GROUP BY tube_sale_ledger.store_id, tube_sale_ledger.brand) x
   ORDER BY x.store_id, x.s DESC
)
SELECT s.id AS store_id,
       s.name AS store_name,
       s.neighborhood, s.boro, s.address_zip, s.status, s.assigned_ambassador_id,
       COALESCE(la.lifetime, 0::numeric) AS lifetime_tubes_delivered,
       COALESCE(oh.total_on_hand, 0::numeric) AS current_inventory_count,
       GREATEST(COALESCE(la.lifetime,0::numeric) - COALESCE(oh.total_on_hand,0::numeric), 0::numeric) AS tubes_sold_estimate,
       COALESCE(la.d30, 0::numeric) AS tubes_last_30_days,
       COALESCE(la.mtd, 0::numeric) AS tubes_this_month,
       COALESCE(la.d90, 0::numeric) AS tubes_last_90_days,
       tb.brand AS top_brand,
       CASE
         WHEN COALESCE(oh.total_on_hand,0::numeric) = 0 THEN 'out_of_stock'
         WHEN COALESCE(oh.total_on_hand,0::numeric) < 50 THEN 'restock_now'
         WHEN COALESCE(oh.total_on_hand,0::numeric) < 200 THEN 'restock_soon'
         ELSE 'stocked'
       END AS restock_status,
       la.last_tx AS last_tube_transaction_at
  FROM stores s
  LEFT JOIN ledger_agg la ON la.store_id = s.id
  LEFT JOIN on_hand oh ON oh.store_id = s.id
  LEFT JOIN top_brand tb ON tb.store_id = s.id
 WHERE s.deleted_at IS NULL
   AND (s.is_test_data = false OR s.is_test_data IS NULL);