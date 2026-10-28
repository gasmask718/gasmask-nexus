CREATE OR REPLACE VIEW public.v_route_candidates AS
 SELECT s.id AS store_id,
    s.name AS store_name,
    s.address_street AS address,
    s.address_city AS city,
    s.neighborhood,
    s.boro,
    'reorder'::text AS candidate_type,
    'inventory'::text AS signal_source,
    'Low stock — needs reorder'::text AS reason,
    'Low stock — needs reorder'::text AS why,
    3 AS priority,
    (0)::numeric AS value,
    s.last_visit_date,
    max(t.last_updated_at) AS signal_at
   FROM (stores s
     JOIN store_tube_inventory_status t ON (((t.store_id = s.id) AND (t.needs_order = true))))
  WHERE ((s.deleted_at IS NULL) AND (s.approval_status = 'approved'::text))
  GROUP BY s.id
UNION ALL
 SELECT s.id AS store_id,
    s.name AS store_name,
    s.address_street AS address,
    s.address_city AS city,
    s.neighborhood,
    s.boro,
    COALESCE(prs.signal_source, 'owner_order'::text) AS candidate_type,
    COALESCE(prs.signal_source, 'owner_order'::text) AS signal_source,
    COALESCE(prs.reason, prs.intent_summary, 'Owner requested order'::text) AS reason,
    COALESCE(prs.reason, prs.intent_summary, 'Owner requested order'::text) AS why,
    COALESCE(prs.priority,
        CASE prs.urgency
            WHEN 'today'::text THEN 5
            WHEN 'this_week'::text THEN 4
            ELSE 3
        END) AS priority,
    COALESCE(prs.estimated_revenue, (0)::numeric) AS value,
    s.last_visit_date,
    prs.created_at AS signal_at
   FROM (pending_route_stops prs
     JOIN stores s ON ((s.id = prs.store_id)))
  WHERE ((prs.status = 'pending_approval'::text) AND (s.deleted_at IS NULL))
UNION ALL
 SELECT s.id AS store_id,
    s.name AS store_name,
    s.address_street AS address,
    s.address_city AS city,
    s.neighborhood,
    s.boro,
    'collect_payment'::text AS candidate_type,
    'invoices'::text AS signal_source,
    ('Unpaid balance: $'::text || (round(sum((COALESCE(i.total_amount, i.total, (0)::numeric) - COALESCE(i.amount_paid, (0)::numeric))), 2))::text) AS reason,
    ('Unpaid balance: $'::text || (round(sum((COALESCE(i.total_amount, i.total, (0)::numeric) - COALESCE(i.amount_paid, (0)::numeric))), 2))::text) AS why,
    4 AS priority,
    sum((COALESCE(i.total_amount, i.total, (0)::numeric) - COALESCE(i.amount_paid, (0)::numeric))) AS value,
    s.last_visit_date,
    max(i.created_at) AS signal_at
   FROM (invoices i
     JOIN stores s ON ((s.id = i.store_id)))
  WHERE ((i.payment_status = ANY (ARRAY['unpaid'::text, 'partial'::text])) AND (s.deleted_at IS NULL))
  GROUP BY s.id
 HAVING (sum((COALESCE(i.total_amount, i.total, (0)::numeric) - COALESCE(i.amount_paid, (0)::numeric))) > (0)::numeric)
UNION ALL
 SELECT s.id AS store_id,
    s.name AS store_name,
    s.address_street AS address,
    s.address_city AS city,
    s.neighborhood,
    s.boro,
    'follow_up'::text AS candidate_type,
    'follow_up_queue'::text AS signal_source,
    COALESCE(fq.reason, 'Follow-up scheduled'::text) AS reason,
    COALESCE(fq.reason, 'Follow-up scheduled'::text) AS why,
    COALESCE(fq.priority, 3) AS priority,
    0 AS value,
    s.last_visit_date,
    fq.created_at AS signal_at
   FROM (follow_up_queue fq
     JOIN stores s ON ((s.id = fq.store_id)))
  WHERE ((COALESCE(fq.status, 'pending'::text) = 'pending'::text) AND (s.deleted_at IS NULL))
UNION ALL
 SELECT s.id AS store_id,
    s.name AS store_name,
    s.address_street AS address,
    s.address_city AS city,
    s.neighborhood,
    s.boro,
    'prospect'::text AS candidate_type,
    'prospect'::text AS signal_source,
    'Prospect — no visit in 30+ days'::text AS reason,
    'Prospect — no visit in 30+ days'::text AS why,
    2 AS priority,
    0 AS value,
    s.last_visit_date,
    s.updated_at AS signal_at
   FROM stores s
  WHERE ((s.deleted_at IS NULL) AND (s.status = 'prospect'::store_status) AND ((s.last_visit_date IS NULL) OR (s.last_visit_date < (now() - '30 days'::interval))))
UNION ALL
 SELECT s.id AS store_id,
    s.name AS store_name,
    s.address_street AS address,
    s.address_city AS city,
    s.neighborhood,
    s.boro,
    'bring_samples'::text AS candidate_type,
    'relationship_status'::text AS signal_source,
    ('Bring samples — '::text || sm.relationship_status) AS reason,
    ('Bring samples — '::text || sm.relationship_status) AS why,
    4 AS priority,
    0 AS value,
    s.last_visit_date,
    COALESCE((s.last_visit_date)::timestamp with time zone, sm.updated_at) AS signal_at
   FROM (stores s
     JOIN store_master sm ON ((sm.id = s.id)))
  WHERE ((s.deleted_at IS NULL) AND (sm.relationship_status = ANY (ARRAY['Need promo (bring samples)'::text, 'Selling slow'::text])) AND ((s.last_visit_date IS NULL) OR (s.last_visit_date < (now() - '21 days'::interval))))
UNION ALL
 SELECT s.id AS store_id,
    s.name AS store_name,
    s.address_street AS address,
    s.address_city AS city,
    s.neighborhood,
    s.boro,
    'win_back'::text AS candidate_type,
    'order_recency'::text AS signal_source,
    (('Win-back — last order '::text || ((EXTRACT(day FROM (now() - (sm.last_order_date)::timestamp with time zone)))::integer)::text) || ' days ago'::text) AS reason,
    (('Win-back — last order '::text || ((EXTRACT(day FROM (now() - (sm.last_order_date)::timestamp with time zone)))::integer)::text) || ' days ago'::text) AS why,
    4 AS priority,
    0 AS value,
    s.last_visit_date,
    sm.last_order_date AS signal_at
   FROM (stores s
     JOIN store_master sm ON ((sm.id = s.id)))
  WHERE ((s.deleted_at IS NULL) AND (sm.relationship_status = 'Active (Good)'::text) AND (sm.last_order_date IS NOT NULL) AND (sm.last_order_date < (now() - '45 days'::interval)))
UNION ALL
 SELECT s.id AS store_id,
    s.name AS store_name,
    s.address_street AS address,
    s.address_city AS city,
    s.neighborhood,
    s.boro,
    'at_risk'::text AS candidate_type,
    'velocity'::text AS signal_source,
    (('At-risk — ordering '::text || (COALESCE(ar.pct_of_baseline, (0)::numeric))::text) || '% of own baseline'::text) AS reason,
    (('At-risk — ordering '::text || (COALESCE(ar.pct_of_baseline, (0)::numeric))::text) || '% of own baseline'::text) AS why,
    5 AS priority,
    ar.baseline_monthly_units AS value,
    s.last_visit_date,
    now() AS signal_at
   FROM (v_store_at_risk ar
     JOIN stores s ON ((s.id = ar.store_id)))
  WHERE (s.deleted_at IS NULL)
UNION ALL
 SELECT s.id AS store_id,
    s.name AS store_name,
    s.address_street AS address,
    s.address_city AS city,
    s.neighborhood,
    s.boro,
    'delivery_request'::text AS candidate_type,
    'store_portal'::text AS signal_source,
    (CASE WHEN dr.request_type = 'asap' THEN 'Delivery requested — ASAP' ELSE 'Delivery requested for ' || to_char(dr.requested_date, 'Mon DD') || COALESCE(' (' || dr.time_window || ')', '') END) AS reason,
    (CASE WHEN dr.request_type = 'asap' THEN 'Delivery requested — ASAP' ELSE 'Delivery requested for ' || to_char(dr.requested_date, 'Mon DD') || COALESCE(' (' || dr.time_window || ')', '') END) AS why,
    CASE WHEN dr.request_type = 'asap' THEN 5 ELSE 4 END AS priority,
    0 AS value,
    s.last_visit_date,
    dr.created_at AS signal_at
   FROM (delivery_requests dr
     JOIN stores s ON ((s.id = dr.store_id)))
  WHERE ((dr.status = ANY (ARRAY['new'::text, 'confirmed'::text])) AND (s.deleted_at IS NULL));