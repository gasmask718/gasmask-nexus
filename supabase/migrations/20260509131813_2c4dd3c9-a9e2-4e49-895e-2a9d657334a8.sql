-- Phase 5C: Rewire v_store_tube_summary to canonical v_invoice_effective_tubes
-- DROP CASCADE because dependent views reference the structure
DROP VIEW IF EXISTS public.v_store_tube_summary CASCADE;

CREATE VIEW public.v_store_tube_summary AS
WITH eff AS (
  SELECT i.store_id,
         vet.invoice_id,
         vet.tube_count,
         vet.total,
         i.created_at AS invoice_date
  FROM public.v_invoice_effective_tubes vet
  JOIN public.invoices i ON i.id = vet.invoice_id
  WHERE i.store_id IS NOT NULL AND i.deleted_at IS NULL
),
agg AS (
  SELECT store_id,
         SUM(tube_count)::numeric AS lifetime,
         SUM(total)::numeric AS lifetime_revenue,
         COUNT(DISTINCT invoice_id)::integer AS invoice_count,
         SUM(tube_count) FILTER (WHERE invoice_date >= now() - interval '30 days') AS d30,
         SUM(tube_count) FILTER (WHERE invoice_date >= now() - interval '90 days') AS d90,
         SUM(tube_count) FILTER (WHERE invoice_date >= date_trunc('month', now())) AS mtd,
         SUM(tube_count) FILTER (
           WHERE invoice_date >= date_trunc('month', now()) - interval '1 month'
             AND invoice_date <  date_trunc('month', now())
         ) AS prior_month,
         MAX(invoice_date) AS last_tx
  FROM eff
  GROUP BY store_id
),
on_hand AS (
  SELECT store_id, SUM(tubes_on_hand)::numeric AS total_on_hand
  FROM public.v_store_tubes_on_hand
  GROUP BY store_id
),
top_brand AS (
  SELECT DISTINCT ON (store_id) store_id, brand
  FROM (
    SELECT i.store_id, ili.brand, SUM(ili.quantity) AS s
    FROM public.invoice_line_items ili
    JOIN public.invoices i ON i.id = ili.invoice_id
    WHERE ili.brand IS NOT NULL
      AND i.store_id IS NOT NULL
      AND i.deleted_at IS NULL
      AND i.status = 'finalized'
    GROUP BY i.store_id, ili.brand
  ) x
  ORDER BY store_id, s DESC
)
SELECT s.id AS store_id,
       s.name AS store_name,
       s.neighborhood,
       s.boro,
       s.address_zip,
       s.status,
       s.assigned_ambassador_id,
       COALESCE(a.lifetime, 0)::numeric AS lifetime_tubes_sold,
       COALESCE(a.lifetime, 0)::numeric AS lifetime_tubes_delivered, -- backward-compat alias
       COALESCE(a.lifetime_revenue, 0)::numeric AS lifetime_invoice_revenue,
       COALESCE(a.invoice_count, 0)::integer AS invoice_count,
       COALESCE(oh.total_on_hand, 0)::numeric AS current_inventory_count,
       COALESCE(a.d30, 0)::numeric AS tubes_last_30_days,
       COALESCE(a.mtd, 0)::numeric AS tubes_this_month,
       COALESCE(a.d90, 0)::numeric AS tubes_last_90_days,
       tb.brand AS top_brand,
       CASE
         WHEN COALESCE(oh.total_on_hand, 0) = 0 THEN 'out_of_stock'
         WHEN oh.total_on_hand < 50 THEN 'restock_now'
         WHEN oh.total_on_hand < 200 THEN 'restock_soon'
         ELSE 'stocked'
       END AS restock_status,
       a.last_tx AS last_tube_transaction_at,
       COALESCE(a.prior_month, 0)::numeric AS tubes_prior_month,
       CASE
         WHEN COALESCE(a.prior_month, 0) = 0 THEN NULL
         ELSE round(((COALESCE(a.mtd, 0) - a.prior_month) / a.prior_month) * 100, 1)
       END AS tubes_mom_delta_pct
FROM public.stores s
LEFT JOIN agg a ON a.store_id = s.id
LEFT JOIN on_hand oh ON oh.store_id = s.id
LEFT JOIN top_brand tb ON tb.store_id = s.id
WHERE s.deleted_at IS NULL
  AND (s.is_test_data = false OR s.is_test_data IS NULL);

-- Recreate dependent views (dropped via CASCADE above)
CREATE VIEW public.v_reactivation_targets AS
SELECT s.id AS store_id,
       s.name AS store_name,
       s.address_street AS address_line_1,
       s.boro, s.neighborhood, s.address_zip, s.address_city, s.address_state,
       s.phone, s.email,
       s.assigned_ambassador_id,
       s.reactivation_priority,
       s.reactivation_attempts,
       s.last_reactivation_attempt_at,
       s.activated_at,
       COALESCE(t.lifetime_tubes_delivered, 0) AS lifetime_tubes_delivered,
       t.top_brand,
       t.last_tube_transaction_at,
       CASE WHEN t.last_tube_transaction_at IS NOT NULL
            THEN EXTRACT(day FROM (now() - t.last_tube_transaction_at))::integer
            ELSE NULL END AS days_since_last_delivery,
       round((COALESCE(t.lifetime_tubes_delivered, 0) *
         CASE s.reactivation_priority
           WHEN 'easy_reorder' THEN 1.50
           WHEN 'warm_restart' THEN 1.25
           WHEN 'cold_restart' THEN 1.00
           ELSE 0.75
         END), 2) AS reactivation_score
FROM public.stores s
LEFT JOIN public.v_store_tube_summary t ON t.store_id = s.id
WHERE s.status::text = 'reactivation_target'
  AND s.deleted_at IS NULL
  AND (s.is_test_data = false OR s.is_test_data IS NULL);

CREATE VIEW public.v_neighborhood_tube_intel AS
WITH base AS (
  SELECT s.id AS store_id, s.name,
         COALESCE(s.neighborhood, '(unknown)') AS neighborhood,
         COALESCE(s.boro, '(unknown)') AS boro,
         s.status::text AS status,
         COALESCE(k.lifetime_tubes_delivered, 0) AS lifetime_tubes,
         COALESCE(k.top_brand, '') AS top_brand,
         COALESCE(k.tubes_last_90_days, 0) AS tubes_90d,
         CASE WHEN s.reactivated_at IS NULL
                AND COALESCE(k.lifetime_tubes_delivered, 0) > 0
                AND s.status::text <> 'test'
              THEN 1 ELSE 0 END AS is_reactivation_target,
         CASE WHEN s.status::text = 'active' AND s.reactivated_at IS NOT NULL THEN 1 ELSE 0 END AS revenue_active,
         CASE WHEN s.status::text = 'prospect' THEN 1 ELSE 0 END AS is_prospect,
         CASE WHEN s.status::text = 'lost' THEN 1 ELSE 0 END AS is_lost
  FROM public.stores s
  LEFT JOIN public.v_store_tube_summary k ON k.store_id = s.id
  WHERE s.deleted_at IS NULL AND COALESCE(s.is_test_data, false) = false
), agg AS (
  SELECT neighborhood, boro,
         SUM(lifetime_tubes) AS total_lifetime_tubes,
         SUM(revenue_active) AS revenue_active_count,
         SUM(is_reactivation_target) AS reactivation_target_count,
         SUM(CASE WHEN is_reactivation_target = 1 THEN lifetime_tubes ELSE 0 END) AS reactivation_target_tube_value,
         SUM(is_prospect) AS prospect_count,
         SUM(is_lost) AS lost_count,
         COUNT(*) AS total_known_stores,
         SUM(tubes_90d) AS tubes_90d_total
  FROM base GROUP BY neighborhood, boro
), brand AS (
  SELECT neighborhood, boro, top_brand,
         row_number() OVER (PARTITION BY neighborhood, boro ORDER BY SUM(lifetime_tubes) DESC) AS rn
  FROM base WHERE top_brand <> ''
  GROUP BY neighborhood, boro, top_brand
), top5 AS (
  SELECT x.neighborhood, x.boro,
         jsonb_agg(jsonb_build_object('name', x.name, 'tubes', x.lifetime_tubes, 'status', x.status)
                   ORDER BY x.lifetime_tubes DESC) FILTER (WHERE x.rn <= 5) AS top_5_stores
  FROM (SELECT neighborhood, boro, name, lifetime_tubes, status,
               row_number() OVER (PARTITION BY neighborhood, boro ORDER BY lifetime_tubes DESC) AS rn
        FROM base) x
  GROUP BY x.neighborhood, x.boro
)
SELECT a.neighborhood, a.boro, a.total_lifetime_tubes,
       a.revenue_active_count, a.reactivation_target_count, a.reactivation_target_tube_value,
       a.prospect_count, a.lost_count, a.total_known_stores,
       round((100.0 * a.revenue_active_count) / NULLIF(a.total_known_stores, 0)::numeric, 1) AS takeover_pct,
       b.top_brand,
       round(a.tubes_90d_total / 3.0, 1) AS monthly_velocity,
       round(a.total_lifetime_tubes / 4.0, 0) AS estimated_customers,
       t.top_5_stores
FROM agg a
LEFT JOIN brand b ON b.neighborhood = a.neighborhood AND b.boro = a.boro AND b.rn = 1
LEFT JOIN top5 t ON t.neighborhood = a.neighborhood AND t.boro = a.boro;