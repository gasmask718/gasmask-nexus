CREATE OR REPLACE FUNCTION public.account_activity_feed(
  p_search text DEFAULT NULL,
  p_actor_kind text DEFAULT 'all',
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_action text DEFAULT 'all',
  p_route text DEFAULT 'all'
)
RETURNS TABLE(
  row_id text, row_kind text, store_id uuid, store_name text,
  occurred_at timestamptz, actor_id uuid, actor_name text, actor_role text,
  action text, note_text text, detail_text text,
  route_id uuid, route_name text, route_date date, route_type text, stop_status text,
  total_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH roles AS (
  SELECT user_id,
         CASE WHEN bool_or(role::text IN ('admin','owner','developer')) THEN 'admin'
              WHEN bool_or(role::text = 'va') THEN 'va'
              ELSE 'other' END AS role_label
  FROM user_roles GROUP BY user_id
),
actors AS (
  SELECT DISTINCT ON (actor_id) actor_id, actor_name
  FROM actor_directory_v
  ORDER BY actor_id, CASE actor_kind WHEN 'user' THEN 0 ELSE 1 END
),
store_route AS (
  SELECT DISTINCT ON (st.store_id)
         st.store_id, st.route_id, st.status AS stop_status,
         r.name AS route_name, r.date AS route_date, r.type AS route_type
  FROM route_stops st JOIN routes r ON r.id = st.route_id
  ORDER BY st.store_id, r.date DESC NULLS LAST
),
ev AS (
  SELECT e.id, e.store_id, e.reviewed_at AS occurred_at, e.reviewed_by AS actor_id,
         lower(coalesce(e.review_type,'')) AS role_raw, coalesce(e.action,'reviewed') AS action, e.note
  FROM store_review_events e
),
nt AS (
  SELECT n.id, n.store_id, coalesce(n.note_date, n.created_at) AS occurred_at,
         n.created_by AS actor_id, n.note_text
  FROM store_notes n
  WHERE n.source = 'account_review' AND n.deleted_at IS NULL
),
cand AS (
  SELECT ev.id AS ev_id, nt.id AS nt_id, nt.note_text,
         row_number() OVER (PARTITION BY nt.id ORDER BY abs(extract(epoch FROM (ev.occurred_at - nt.occurred_at)))) AS rn_n,
         row_number() OVER (PARTITION BY ev.id ORDER BY abs(extract(epoch FROM (ev.occurred_at - nt.occurred_at)))) AS rn_e
  FROM ev
  JOIN nt ON nt.store_id = ev.store_id
        AND nt.occurred_at BETWEEN ev.occurred_at - interval '10 minutes' AND ev.occurred_at + interval '10 minutes'
),
pair AS (SELECT ev_id, nt_id, note_text FROM cand WHERE rn_n = 1 AND rn_e = 1),
base AS (
  SELECT 'ev:'||ev.id::text AS row_id, 'review'::text AS row_kind, ev.store_id, ev.occurred_at, ev.actor_id,
         CASE WHEN ev.role_raw IN ('admin','va') THEN ev.role_raw
              WHEN ev.actor_id IS NULL THEN 'unattributed' ELSE 'other' END AS role_hint,
         ev.action AS action, coalesce(p.note_text, ev.note) AS note_text, NULL::text AS detail_text
  FROM ev LEFT JOIN pair p ON p.ev_id = ev.id
  UNION ALL
  SELECT 'nt:'||nt.id::text, 'note', nt.store_id, nt.occurred_at, nt.actor_id,
         CASE WHEN nt.actor_id IS NULL THEN 'unattributed' ELSE 'other' END,
         'note_added', nt.note_text, NULL
  FROM nt WHERE NOT EXISTS (SELECT 1 FROM pair p WHERE p.nt_id = nt.id)
  UNION ALL
  SELECT 'au:'||a.id::text, 'correction', a.record_id, a.acted_at, coalesce(a.acted_by, a.actor_user_id),
         NULL,
         CASE
           WHEN coalesce(coalesce(a.new_data,a.after) ->> 'deleted_at', '') <> ''
                AND coalesce(coalesce(a.old_data,a.before) ->> 'deleted_at','') = '' THEN 'store_removed'
           WHEN a.changed_fields && array['address','address_street','address_city','address_state','address_zip'] THEN 'address_corrected'
           WHEN a.changed_fields && array['name','store_name'] THEN 'name_changed'
           WHEN a.changed_fields && array['phone'] THEN 'phone_updated'
           WHEN a.changed_fields && array['relationship_status','status'] THEN 'status_changed'
           ELSE 'record_updated'
         END,
         NULL,
         public._aa_change_summary(coalesce(a.old_data, a.before), coalesce(a.new_data, a.after), a.changed_fields)
  FROM audit_log a
  WHERE a.table_name IN ('stores','store_master')
    AND a.action = 'UPDATE'
    AND a.changed_fields && array['name','store_name','address','address_street','address_city','address_state',
                                  'address_zip','phone','relationship_status','status','deleted_at','owner_name','contact_name']
  UNION ALL
  SELECT 'ic:'||i.id::text, 'invoice', i.store_id, i.created_at,
         CASE WHEN i.created_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN i.created_by::uuid END, NULL,
         'invoice_created', i.notes,
         'Invoice #'||coalesce(i.invoice_number,'-')||' created for $'||to_char(coalesce(i.total_amount, i.total, 0),'FM999999990.00')||
         coalesce(' by '||nullif(i.created_by,''),'')
  FROM invoices i WHERE i.store_id IS NOT NULL AND i.created_at IS NOT NULL
  UNION ALL
  SELECT 'ip:'||i.id::text, 'payment', i.store_id, i.paid_at,
         CASE WHEN i.received_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN i.received_by::uuid END, NULL,
         'payment_recorded', i.notes,
         'Payment $'||to_char(coalesce(nullif(i.amount_paid,0), i.total_amount, i.total, 0),'FM999999990.00')||
         ' on invoice #'||coalesce(i.invoice_number,'-')||coalesce(' via '||i.payment_method,'')||
         coalesce(' received by '||nullif(i.received_by,''),'')
  FROM invoices i WHERE i.store_id IS NOT NULL AND i.paid_at IS NOT NULL
  UNION ALL
  SELECT 'id:'||i.id::text, 'invoice', i.store_id, i.deleted_at, i.deleted_by, NULL,
         'invoice_removed', i.delete_reason,
         'Invoice #'||coalesce(i.invoice_number,'-')||' ($'||to_char(coalesce(i.total_amount, i.total, 0),'FM999999990.00')||
         ') removed'||coalesce(' - '||i.delete_reason,' - no reason recorded')
  FROM invoices i WHERE i.store_id IS NOT NULL AND i.deleted_at IS NOT NULL
  UNION ALL
  SELECT 'rt:'||st.id::text, 'route', st.store_id, st.created_at, NULL::uuid, NULL,
         'route_assigned', st.notes_to_worker,
         'Added to '||coalesce(r.name,'route')||coalesce(' ('||r.type||')','')||
         coalesce(' on '||to_char(r.date,'Mon DD, YYYY'),'')
  FROM route_stops st JOIN routes r ON r.id = st.route_id
  WHERE st.store_id IS NOT NULL AND st.created_at IS NOT NULL
),
enriched AS (
  SELECT b.row_id, b.row_kind, b.store_id, s.name AS store_name, b.occurred_at, b.actor_id,
         coalesce(ac.actor_name, CASE WHEN b.actor_id IS NULL THEN 'Unattributed' ELSE 'Unknown user' END) AS actor_name,
         CASE
           WHEN b.role_hint IS NOT NULL THEN b.role_hint
           WHEN b.actor_id IS NULL THEN 'unattributed'
           ELSE coalesce(rl.role_label, 'other')
         END AS actor_role,
         b.action, b.note_text, b.detail_text,
         sr.route_id, sr.route_name, sr.route_date, sr.route_type, sr.stop_status
  FROM base b
  LEFT JOIN stores s ON s.id = b.store_id
  LEFT JOIN actors ac ON ac.actor_id = b.actor_id
  LEFT JOIN roles rl ON rl.user_id = b.actor_id
  LEFT JOIN store_route sr ON sr.store_id = b.store_id
),
filtered AS (
  SELECT * FROM enriched e
  WHERE e.occurred_at IS NOT NULL
    AND (p_from IS NULL OR e.occurred_at >= p_from)
    AND (p_to IS NULL OR e.occurred_at <= p_to)
    AND (p_actor_kind IS NULL OR p_actor_kind = 'all' OR e.actor_role = p_actor_kind)
    AND (p_action IS NULL OR p_action = 'all' OR e.action = p_action)
    AND (p_route IS NULL OR p_route = 'all'
         OR (p_route = 'on_route' AND e.route_id IS NOT NULL)
         OR (p_route = 'off_route' AND e.route_id IS NULL))
    AND (
      p_search IS NULL OR p_search = ''
      OR e.note_text ILIKE '%'||p_search||'%'
      OR e.detail_text ILIKE '%'||p_search||'%'
      OR e.store_name ILIKE '%'||p_search||'%'
      OR e.actor_name ILIKE '%'||p_search||'%'
      OR e.action ILIKE '%'||p_search||'%'
      OR e.route_name ILIKE '%'||p_search||'%'
    )
)
SELECT row_id, row_kind, store_id, store_name, occurred_at, actor_id, actor_name, actor_role,
       action, note_text, detail_text, route_id, route_name, route_date, route_type, stop_status,
       count(*) OVER () AS total_count
FROM filtered
ORDER BY occurred_at DESC NULLS LAST, row_id
LIMIT greatest(1, least(coalesce(p_limit,50), 200))
OFFSET greatest(0, coalesce(p_offset,0));
$function$;

REVOKE ALL ON FUNCTION public.account_activity_feed(text, text, timestamptz, timestamptz, integer, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_activity_feed(text, text, timestamptz, timestamptz, integer, integer, text, text) TO authenticated, service_role;