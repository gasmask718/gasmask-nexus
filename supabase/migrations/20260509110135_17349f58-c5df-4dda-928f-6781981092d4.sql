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
    sum(tube_sale_ledger.tubes_delta) FILTER (WHERE tube_sale_ledger.created_at >= date_trunc('month'::text, now())) AS mtd,
    sum(tube_sale_ledger.tubes_delta) FILTER (
      WHERE tube_sale_ledger.created_at >= (date_trunc('month'::text, now()) - interval '1 month')
        AND tube_sale_ledger.created_at <  date_trunc('month'::text, now())
    ) AS prior_month,
    max(tube_sale_ledger.created_at) AS last_tx
  FROM tube_sale_ledger
  GROUP BY tube_sale_ledger.store_id
), top_brand AS (
  SELECT DISTINCT ON (x.store_id) x.store_id, x.brand
  FROM (
    SELECT tube_sale_ledger.store_id, tube_sale_ledger.brand,
      sum(tube_sale_ledger.tubes_delta) AS s
    FROM tube_sale_ledger
    WHERE tube_sale_ledger.brand IS NOT NULL
    GROUP BY tube_sale_ledger.store_id, tube_sale_ledger.brand
  ) x
  ORDER BY x.store_id, x.s DESC
)
SELECT s.id AS store_id,
  s.name AS store_name,
  s.neighborhood,
  s.boro,
  s.address_zip,
  s.status,
  s.assigned_ambassador_id,
  COALESCE(la.lifetime, 0::numeric) AS lifetime_tubes_delivered,
  COALESCE(oh.total_on_hand, 0::numeric) AS current_inventory_count,
  GREATEST(COALESCE(la.lifetime, 0::numeric) - COALESCE(oh.total_on_hand, 0::numeric), 0::numeric) AS tubes_sold_estimate,
  COALESCE(la.d30, 0::numeric) AS tubes_last_30_days,
  COALESCE(la.mtd, 0::numeric) AS tubes_this_month,
  COALESCE(la.d90, 0::numeric) AS tubes_last_90_days,
  tb.brand AS top_brand,
  CASE
    WHEN COALESCE(oh.total_on_hand, 0::numeric) = 0::numeric THEN 'out_of_stock'::text
    WHEN COALESCE(oh.total_on_hand, 0::numeric) < 50::numeric THEN 'restock_now'::text
    WHEN COALESCE(oh.total_on_hand, 0::numeric) < 200::numeric THEN 'restock_soon'::text
    ELSE 'stocked'::text
  END AS restock_status,
  la.last_tx AS last_tube_transaction_at,
  COALESCE(la.prior_month, 0::numeric) AS tubes_prior_month,
  CASE
    WHEN COALESCE(la.prior_month, 0::numeric) = 0::numeric THEN NULL::numeric
    ELSE round(((COALESCE(la.mtd, 0::numeric) - COALESCE(la.prior_month, 0::numeric))::numeric / COALESCE(la.prior_month, 0::numeric)::numeric) * 100::numeric, 1)
  END AS tubes_mom_delta_pct
FROM stores s
  LEFT JOIN ledger_agg la ON la.store_id = s.id
  LEFT JOIN on_hand oh ON oh.store_id = s.id
  LEFT JOIN top_brand tb ON tb.store_id = s.id
WHERE s.deleted_at IS NULL AND (s.is_test_data = false OR s.is_test_data IS NULL);