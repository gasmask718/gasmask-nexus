CREATE OR REPLACE VIEW public.v_prior_customer_segments AS
WITH agg AS (
  SELECT
    i.store_id,
    COUNT(*)::int                                AS invoice_count,
    COALESCE(SUM(i.total), 0)::numeric           AS lifetime_revenue,
    COALESCE(SUM(i.total_tubes_sold), 0)::int    AS lifetime_tubes,
    MAX(i.created_at)                            AS last_order_date
  FROM public.invoices i
  WHERE i.status = 'finalized'
    AND i.store_id IS NOT NULL
    AND i.deleted_at IS NULL
  GROUP BY i.store_id
)
SELECT
  s.id                                         AS store_id,
  s.store_name,
  s.phone,
  s.phone_type,
  s.sms_capable,
  a.invoice_count,
  a.lifetime_revenue,
  a.lifetime_tubes,
  a.last_order_date,
  EXTRACT(DAY FROM (now() - a.last_order_date))::int AS days_since_last_order,
  CASE
    WHEN now() - a.last_order_date <= INTERVAL '45 days'  THEN 'active_flow'
    WHEN now() - a.last_order_date <= INTERVAL '120 days' THEN 'recently_quiet'
    WHEN now() - a.last_order_date <= INTERVAL '270 days' THEN 'cold'
    ELSE 'long_dormant'
  END AS flow_status
FROM agg a
JOIN public.store_master s ON s.id = a.store_id;

GRANT SELECT ON public.v_prior_customer_segments TO authenticated, anon, service_role;