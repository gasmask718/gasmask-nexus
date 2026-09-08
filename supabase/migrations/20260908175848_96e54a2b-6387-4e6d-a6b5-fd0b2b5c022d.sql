
CREATE OR REPLACE FUNCTION public.account_activity_feed(
  p_search text DEFAULT NULL,
  p_actor_kind text DEFAULT 'all',
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  row_id text,
  row_kind text,
  store_id uuid,
  store_name text,
  occurred_at timestamptz,
  actor_id uuid,
  actor_name text,
  actor_role text,
  action text,
  note_text text,
  route_id uuid,
  route_name text,
  route_date date,
  route_type text,
  stop_status text,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH ev AS (
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
pair AS (
  SELECT ev_id, nt_id, note_text FROM cand WHERE rn_n = 1 AND rn_e = 1
),
merged AS (
  SELECT 'ev:'||ev.id::text AS row_id, 'review_event'::text AS row_kind, ev.store_id, ev.occurred_at, ev.actor_id,
         CASE WHEN ev.role_raw IN ('admin','va') THEN ev.role_raw
              WHEN ev.actor_id IS NULL THEN 'unattributed' ELSE 'other' END AS actor_role,
         ev.action,
         coalesce(p.note_text, ev.note) AS note_text
  FROM ev LEFT JOIN pair p ON p.ev_id = ev.id
  UNION ALL
  SELECT 'nt:'||nt.id::text, 'review_note', nt.store_id, nt.occurred_at, nt.actor_id,
         CASE WHEN nt.actor_id IS NULL THEN 'unattributed' ELSE 'other' END,
         'note', nt.note_text
  FROM nt
  WHERE NOT EXISTS (SELECT 1 FROM pair p WHERE p.nt_id = nt.id)
),
enriched AS (
  SELECT m.*, s.name AS store_name, ad.actor_name,
         rs.route_id, r.name AS route_name, r.date AS route_date, r.type AS route_type, rs.status AS stop_status
  FROM merged m
  LEFT JOIN stores s ON s.id = m.store_id
  LEFT JOIN actor_directory_v ad ON ad.actor_id = m.actor_id
  LEFT JOIN LATERAL (
    SELECT st.route_id, st.status
    FROM route_stops st
    JOIN routes rr ON rr.id = st.route_id
    WHERE st.store_id = m.store_id
    ORDER BY rr.date DESC NULLS LAST
    LIMIT 1
  ) rs ON true
  LEFT JOIN routes r ON r.id = rs.route_id
),
filtered AS (
  SELECT * FROM enriched e
  WHERE (p_from IS NULL OR e.occurred_at >= p_from)
    AND (p_to IS NULL OR e.occurred_at <= p_to)
    AND (p_actor_kind IS NULL OR p_actor_kind = 'all' OR e.actor_role = p_actor_kind)
    AND (
      p_search IS NULL OR p_search = ''
      OR e.note_text ILIKE '%'||p_search||'%'
      OR e.store_name ILIKE '%'||p_search||'%'
      OR e.actor_name ILIKE '%'||p_search||'%'
      OR e.action ILIKE '%'||p_search||'%'
      OR EXISTS (
        SELECT 1 FROM audit_log a
        WHERE a.record_id = e.store_id
          AND a.table_name IN ('stores','store_master')
          AND a.acted_at BETWEEN e.occurred_at - interval '1 hour' AND e.occurred_at + interval '1 hour'
          AND coalesce(a.new_data::text, a.after::text, '') ILIKE '%'||p_search||'%'
      )
    )
)
SELECT row_id, row_kind, store_id, store_name, occurred_at, actor_id,
       coalesce(actor_name, CASE WHEN actor_id IS NULL THEN 'Unattributed' ELSE 'Unknown user' END),
       actor_role, action, note_text, route_id, route_name, route_date, route_type, stop_status,
       count(*) OVER () AS total_count
FROM filtered
ORDER BY occurred_at DESC NULLS LAST, row_id
LIMIT greatest(1, least(coalesce(p_limit,50), 200))
OFFSET greatest(0, coalesce(p_offset,0));
$$;

REVOKE ALL ON FUNCTION public.account_activity_feed(text,text,timestamptz,timestamptz,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_activity_feed(text,text,timestamptz,timestamptz,int,int) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.account_activity_row_detail(p_store_id uuid, p_at timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT jsonb_build_object(
  'invoices', (
    SELECT jsonb_build_object(
      'open_balance', coalesce(sum(greatest(coalesce(i.total_amount,0) - coalesce(i.amount_paid,0), 0)) FILTER (WHERE coalesce(i.payment_status,'') <> 'paid'), 0),
      'paid_count', count(*) FILTER (WHERE i.payment_status = 'paid'),
      'unpaid_count', count(*) FILTER (WHERE coalesce(i.payment_status,'') <> 'paid'),
      'total_count', count(*),
      'total_billed', coalesce(sum(coalesce(i.total_amount,0)), 0)
    )
    FROM invoices i WHERE i.store_id = p_store_id AND i.deleted_at IS NULL
  ),
  'route', (
    SELECT jsonb_build_object('route_id', r.id, 'name', r.name, 'date', r.date, 'type', r.type,
                              'status', r.status, 'stop_status', st.status, 'planned_order', st.planned_order)
    FROM route_stops st JOIN routes r ON r.id = st.route_id
    WHERE st.store_id = p_store_id
    ORDER BY r.date DESC NULLS LAST LIMIT 1
  ),
  'comms', (
    SELECT jsonb_build_object(
      'total', count(*),
      'calls', count(*) FILTER (WHERE coalesce(c.channel, c.call_type) ILIKE '%call%'),
      'texts', count(*) FILTER (WHERE coalesce(c.channel,'') ILIKE '%sms%' OR coalesce(c.channel,'') ILIKE '%text%'),
      'inbound', count(*) FILTER (WHERE c.direction = 'inbound'),
      'last_at', max(c.created_at),
      'recent', coalesce((
        SELECT jsonb_agg(x) FROM (
          SELECT c2.created_at, c2.channel, c2.direction, c2.outcome,
                 left(coalesce(c2.summary, c2.message_content, c2.full_message, ''), 240) AS summary
          FROM communication_logs c2 WHERE c2.store_id = p_store_id
          ORDER BY c2.created_at DESC LIMIT 10
        ) x), '[]'::jsonb)
    )
    FROM communication_logs c WHERE c.store_id = p_store_id
  ),
  'notes', coalesce((
    SELECT jsonb_agg(x) FROM (
      SELECT n.id, coalesce(n.note_date, n.created_at) AS at, n.note_text, n.source
      FROM store_notes n
      WHERE n.store_id = p_store_id AND n.deleted_at IS NULL
        AND coalesce(n.note_date, n.created_at) BETWEEN p_at - interval '1 hour' AND p_at + interval '1 hour'
      ORDER BY coalesce(n.note_date, n.created_at) DESC LIMIT 20
    ) x), '[]'::jsonb),
  'corrections', coalesce((
    SELECT jsonb_agg(x) FROM (
      SELECT a.acted_at, a.table_name, a.action, a.changed_fields,
             a.old_data, a.new_data
      FROM audit_log a
      WHERE a.record_id = p_store_id AND a.table_name IN ('stores','store_master')
        AND a.acted_at BETWEEN p_at - interval '1 hour' AND p_at + interval '1 hour'
      ORDER BY a.acted_at DESC LIMIT 20
    ) x), '[]'::jsonb),
  'deleted_invoices', coalesce((
    SELECT jsonb_agg(x) FROM (
      SELECT i.id, i.invoice_number, i.total_amount, i.deleted_at, i.delete_reason
      FROM invoices i
      WHERE i.store_id = p_store_id AND i.deleted_at IS NOT NULL
      ORDER BY i.deleted_at DESC LIMIT 20
    ) x), '[]'::jsonb)
);
$$;

REVOKE ALL ON FUNCTION public.account_activity_row_detail(uuid,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_activity_row_detail(uuid,timestamptz) TO authenticated, service_role;
