
CREATE OR REPLACE VIEW public.v_route_candidates AS
SELECT
  s.id AS store_id, s.name AS store_name,
  s.address_street AS address, s.address_city AS city, s.neighborhood, s.boro,
  'reorder'::text AS candidate_type,
  'Low stock — needs reorder'::text AS why,
  3 AS priority, 0::numeric AS value,
  s.last_visit_date, MAX(t.last_updated_at) AS signal_at
FROM public.stores s
JOIN public.store_tube_inventory_status t ON t.store_id = s.id AND t.needs_order = true
WHERE s.deleted_at IS NULL AND s.approval_status = 'approved'
GROUP BY s.id
UNION ALL
SELECT s.id, s.name, s.address_street, s.address_city, s.neighborhood, s.boro,
  'owner_order', COALESCE(prs.intent_summary, 'Owner requested order'),
  CASE prs.urgency WHEN 'today' THEN 5 WHEN 'this_week' THEN 4 ELSE 3 END,
  COALESCE(prs.estimated_revenue, 0)::numeric, s.last_visit_date, prs.created_at
FROM public.pending_route_stops prs
JOIN public.stores s ON s.id = prs.store_id
WHERE prs.status = 'pending_approval' AND s.deleted_at IS NULL
UNION ALL
SELECT s.id, s.name, s.address_street, s.address_city, s.neighborhood, s.boro,
  'collect_payment',
  'Unpaid balance: $' || ROUND(SUM(COALESCE(i.total_amount,i.total,0) - COALESCE(i.amount_paid,0))::numeric, 2)::text,
  4,
  SUM(COALESCE(i.total_amount,i.total,0) - COALESCE(i.amount_paid,0))::numeric,
  s.last_visit_date, now()
FROM public.invoices i
JOIN public.stores s ON s.id = i.store_id
WHERE i.payment_status IN ('unpaid','partial') AND s.deleted_at IS NULL
GROUP BY s.id
UNION ALL
SELECT s.id, s.name, s.address_street, s.address_city, s.neighborhood, s.boro,
  'follow_up', COALESCE(fq.reason, 'Follow-up due'),
  CASE WHEN fq.priority >= 4 THEN 5 WHEN fq.priority >= 2 THEN 3 ELSE 2 END,
  0::numeric, s.last_visit_date, fq.due_at
FROM public.follow_up_queue fq
JOIN public.stores s ON s.id = fq.store_id
WHERE fq.status = 'pending' AND fq.due_at <= now() + interval '7 days' AND s.deleted_at IS NULL
UNION ALL
SELECT s.id, s.name, s.address_street, s.address_city, s.neighborhood, s.boro,
  'prospect', 'Prospect — no visit in 30+ days',
  1, 0::numeric, s.last_visit_date,
  COALESCE(s.last_visit_date::timestamptz, now() - interval '60 days')
FROM public.stores s
WHERE s.deleted_at IS NULL AND s.approval_status = 'approved'
  AND s.status = 'prospect'
  AND (s.last_visit_date IS NULL OR s.last_visit_date < (now() - interval '30 days')::date);

GRANT SELECT ON public.v_route_candidates TO authenticated, anon, service_role;
