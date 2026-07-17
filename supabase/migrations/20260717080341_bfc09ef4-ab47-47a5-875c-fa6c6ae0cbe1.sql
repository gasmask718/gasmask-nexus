
-- Actor directory (id -> display name)
CREATE OR REPLACE VIEW public.actor_directory_v
WITH (security_invoker = true) AS
SELECT p.id AS actor_id, COALESCE(NULLIF(p.name,''), p.email, 'User') AS actor_name, 'user'::text AS actor_kind
  FROM public.profiles p
UNION ALL
SELECT a.user_id, COALESCE(NULLIF(a.name,''), a.email, 'Ambassador'), 'ambassador'
  FROM public.ambassadors a WHERE a.user_id IS NOT NULL
UNION ALL
SELECT d.user_id, COALESCE(NULLIF(d.full_name,''), d.email, 'Driver'), 'driver'
  FROM public.drivers d WHERE d.user_id IS NOT NULL
UNION ALL
SELECT b.user_id, COALESCE(NULLIF(b.full_name,''), b.email, 'Biker'), 'biker'
  FROM public.bikers b WHERE b.user_id IS NOT NULL;

GRANT SELECT ON public.actor_directory_v TO authenticated, service_role;

-- Unified account activity feed
CREATE OR REPLACE VIEW public.store_activity_feed_v
WITH (security_invoker = true) AS
SELECT
  'review'::text                                   AS kind,
  r.id                                             AS id,
  r.store_id                                       AS store_id,
  r.reviewed_by                                    AS actor_id,
  r.reviewed_at                                    AS occurred_at,
  r.review_type                                    AS subtype,
  r.action                                         AS detail,
  r.note                                           AS body
FROM public.store_review_events r
UNION ALL
SELECT
  CASE WHEN c.channel ILIKE '%sms%' OR c.channel ILIKE '%text%' THEN 'text' ELSE 'call' END,
  c.id,
  c.store_id,
  COALESCE(c.created_by, c.operator_id),
  COALESCE(c.started_at, c.created_at),
  COALESCE(c.channel, c.call_type),
  COALESCE(c.call_type, c.direction, c.outcome),
  COALESCE(c.summary, c.notes, c.transcript, c.message_content)
FROM public.communication_logs c
WHERE c.store_id IS NOT NULL
UNION ALL
SELECT
  'visit',
  v.id,
  v.store_id,
  v.visited_by,
  COALESCE(v.started_at, v.created_at),
  v.visit_type,
  v.status,
  v.notes
FROM public.store_visits v;

GRANT SELECT ON public.store_activity_feed_v TO authenticated, service_role;

-- Samples by store with effectiveness
CREATE OR REPLACE VIEW public.samples_by_store_v
WITH (security_invoker = true) AS
WITH samples AS (
  SELECT
    s.store_id,
    s.brand,
    COUNT(*)::int          AS repeat_count,
    COALESCE(SUM(s.quantity),0)::int AS total_units,
    MIN(s.given_at)        AS first_sample_at,
    MAX(s.given_at)        AS last_sample_at
  FROM public.store_samples_given s
  GROUP BY s.store_id, s.brand
),
first_order AS (
  SELECT
    sm.store_id,
    sm.brand,
    (SELECT MIN(i.created_at)
       FROM public.invoices i
      WHERE i.store_id = sm.store_id AND i.created_at > sm.first_sample_at) AS first_order_after,
    (SELECT COUNT(*)
       FROM public.invoices i
      WHERE i.store_id = sm.store_id
        AND i.created_at > sm.first_sample_at
        AND i.created_at < sm.first_sample_at + INTERVAL '90 days') AS orders_90d,
    (SELECT COALESCE(SUM(COALESCE(i.total_amount, i.total)),0)
       FROM public.invoices i
      WHERE i.store_id = sm.store_id
        AND i.created_at > sm.first_sample_at
        AND i.created_at < sm.first_sample_at + INTERVAL '90 days') AS revenue_90d
  FROM samples sm
)
SELECT
  s.store_id,
  st.name AS store_name,
  s.brand,
  s.repeat_count,
  s.total_units,
  s.first_sample_at,
  s.last_sample_at,
  f.first_order_after,
  CASE WHEN f.first_order_after IS NOT NULL
       THEN EXTRACT(EPOCH FROM (f.first_order_after - s.first_sample_at))/86400.0
  END::numeric(10,2) AS days_to_first_order,
  COALESCE(f.orders_90d,0)::int AS orders_90d,
  COALESCE(f.revenue_90d,0)::numeric AS revenue_90d
FROM samples s
LEFT JOIN first_order f USING (store_id, brand)
LEFT JOIN public.stores st ON st.id = s.store_id;

GRANT SELECT ON public.samples_by_store_v TO authenticated, service_role;
