
DROP VIEW IF EXISTS public.v_neighborhood_tube_intel CASCADE;
CREATE VIEW public.v_neighborhood_tube_intel AS
WITH base AS (
  SELECT
    s.id AS store_id,
    s.name,
    COALESCE(s.neighborhood,'(unknown)') AS neighborhood,
    COALESCE(s.boro,'(unknown)') AS boro,
    s.status::text AS status,
    COALESCE(k.lifetime_tubes_delivered, 0) AS lifetime_tubes,
    COALESCE(k.top_brand,'') AS top_brand,
    COALESCE(k.tubes_last_90_days, 0) AS tubes_90d,
    CASE WHEN s.reactivated_at IS NULL
              AND COALESCE(k.lifetime_tubes_delivered,0) > 0
              AND s.status::text NOT IN ('test')
         THEN 1 ELSE 0 END AS is_reactivation_target,
    CASE WHEN s.status::text = 'active' AND s.reactivated_at IS NOT NULL THEN 1 ELSE 0 END AS revenue_active,
    CASE WHEN s.status::text = 'prospect' THEN 1 ELSE 0 END AS is_prospect,
    CASE WHEN s.status::text = 'lost' THEN 1 ELSE 0 END AS is_lost
  FROM public.stores s
  LEFT JOIN public.v_store_tube_summary k ON k.store_id = s.id
  WHERE s.deleted_at IS NULL
    AND COALESCE(s.is_test_data,false) = false
),
agg AS (
  SELECT
    neighborhood, boro,
    SUM(lifetime_tubes) AS total_lifetime_tubes,
    SUM(revenue_active) AS revenue_active_count,
    SUM(is_reactivation_target) AS reactivation_target_count,
    SUM(CASE WHEN is_reactivation_target=1 THEN lifetime_tubes ELSE 0 END) AS reactivation_target_tube_value,
    SUM(is_prospect) AS prospect_count,
    SUM(is_lost) AS lost_count,
    COUNT(*) AS total_known_stores,
    SUM(tubes_90d) AS tubes_90d_total
  FROM base GROUP BY neighborhood, boro
),
brand AS (
  SELECT neighborhood, boro, top_brand,
    ROW_NUMBER() OVER (PARTITION BY neighborhood, boro ORDER BY SUM(lifetime_tubes) DESC) rn
  FROM base WHERE top_brand <> '' GROUP BY neighborhood, boro, top_brand
),
top5 AS (
  SELECT neighborhood, boro,
    jsonb_agg(jsonb_build_object('name', name, 'tubes', lifetime_tubes, 'status', status)
              ORDER BY lifetime_tubes DESC) FILTER (WHERE rn <= 5) AS top_5_stores
  FROM (
    SELECT neighborhood, boro, name, lifetime_tubes, status,
      ROW_NUMBER() OVER (PARTITION BY neighborhood, boro ORDER BY lifetime_tubes DESC) rn
    FROM base
  ) x
  GROUP BY neighborhood, boro
)
SELECT
  a.neighborhood, a.boro,
  a.total_lifetime_tubes,
  a.revenue_active_count,
  a.reactivation_target_count,
  a.reactivation_target_tube_value,
  a.prospect_count,
  a.lost_count,
  a.total_known_stores,
  ROUND(100.0 * a.revenue_active_count / NULLIF(a.total_known_stores,0), 1) AS takeover_pct,
  b.top_brand,
  ROUND(a.tubes_90d_total / 3.0, 1) AS monthly_velocity,
  ROUND(a.total_lifetime_tubes / 4.0, 0) AS estimated_customers,
  t.top_5_stores
FROM agg a
LEFT JOIN brand b ON b.neighborhood = a.neighborhood AND b.boro = a.boro AND b.rn = 1
LEFT JOIN top5  t ON t.neighborhood = a.neighborhood AND t.boro = a.boro;

GRANT SELECT ON public.v_neighborhood_tube_intel TO authenticated, anon;

DROP VIEW IF EXISTS public.v_field_capture_queue CASCADE;
CREATE VIEW public.v_field_capture_queue AS
SELECT
  q.id AS queue_id,
  q.status,
  q.priority,
  q.assigned_ambassador_id,
  q.reason,
  s.id AS store_id,
  s.name AS store_name,
  s.phone,
  s.email,
  s.boro,
  s.neighborhood,
  v.lifetime_tubes_delivered,
  v.last_tube_transaction_at,
  v.reactivation_priority,
  (SELECT array_agg(s2.name)
   FROM public.stores s2
   WHERE s2.boro = s.boro
     AND s2.assigned_ambassador_id = q.assigned_ambassador_id
     AND s2.address_zip IS NOT NULL
     AND s2.deleted_at IS NULL
   LIMIT 5) AS nearby_assigned_stores
FROM public.field_capture_queue q
JOIN public.stores s ON s.id = q.store_id
LEFT JOIN public.v_reactivation_targets v ON v.store_id = s.id
WHERE q.status IN ('pending','assigned');

GRANT SELECT ON public.v_field_capture_queue TO authenticated;
