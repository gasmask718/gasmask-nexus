
DROP VIEW IF EXISTS public.v_store_activity;

CREATE VIEW public.v_store_activity
WITH (security_invoker = true) AS
WITH review_ranked AS (
  SELECT r.*,
         row_number() OVER (PARTITION BY r.store_id, r.review_type ORDER BY r.reviewed_at DESC, r.created_at DESC) AS rn
  FROM public.store_review_events r
)
SELECT
  'review:'::text || r.id::text            AS activity_id,
  r.store_id,
  CASE WHEN r.rn = 1 THEN 'review' ELSE 'review_audit' END AS kind,
  r.review_type                            AS subtype,
  COALESCE(r.reviewed_at, r.created_at)    AS occurred_at,
  r.reviewed_by                            AS actor_id,
  NULL::uuid                               AS contact_id,
  CASE WHEN r.action = 'reviewed' THEN 'Marked reviewed (' || r.review_type || ')'
       ELSE 'Review removed (' || r.review_type || ')' END AS title,
  r.note                                   AS detail,
  r.action                                 AS status,
  false                                    AS is_open,
  NULL::text                               AS direction,
  (r.rn = 1)                               AS is_current
FROM review_ranked r

UNION ALL
SELECT 'note:' || n.id::text, n.store_id, 'note', COALESCE(n.brand_scope,'note'),
       COALESCE(n.edited_at, n.created_at), n.created_by, NULL::uuid,
       CASE WHEN n.edited_at IS NOT NULL THEN 'Note edited' ELSE 'Note added' END,
       left(COALESCE(n.note_text,''), 240), 'logged', false, NULL::text, true
FROM public.store_notes n
WHERE n.deleted_at IS NULL AND n.store_id IS NOT NULL

UNION ALL
SELECT 'comm:' || c.source_table || ':' || c.source_id,
       c.store_id,
       CASE WHEN c.channel = 'sms' THEN 'text' ELSE 'call' END,
       CASE WHEN c.is_ai THEN 'ai' ELSE 'human' END,
       c.occurred_at,
       NULL::uuid,
       c.contact_id,
       CASE
         WHEN c.channel = 'sms' AND c.direction = 'inbound' THEN 'Inbound reply'
         WHEN c.channel = 'sms' THEN 'Text sent'
         WHEN c.is_ai THEN 'Call answered by AI'
         WHEN COALESCE(c.status, c.outcome) IN ('no-answer','no_answer','missed','busy','failed','canceled','cancelled','voicemail') THEN 'Missed / unanswered call'
         WHEN c.direction = 'inbound' THEN 'Inbound call'
         ELSE 'Outbound call'
       END,
       left(COALESCE(c.summary, c.body, c.transcript, ''), 240),
       COALESCE(c.outcome, c.status),
       CASE
         WHEN c.channel = 'sms' AND c.direction = 'inbound' THEN cl.read_at IS NULL
         WHEN c.channel <> 'sms'
              AND COALESCE(c.status, c.outcome) IN ('no-answer','no_answer','missed','busy','failed','canceled','cancelled','voicemail')
           THEN cl.handled_at IS NULL
         ELSE false
       END,
       c.direction,
       true
FROM public.v_store_comms_detail c
LEFT JOIN public.communication_logs cl
  ON c.source_table = 'communication_logs' AND cl.id::text = c.source_id
WHERE c.store_id IS NOT NULL

UNION ALL
SELECT 'visit:' || v.id::text, v.store_id, 'visit', v.visit_type,
       COALESCE(v.completed_at, v.started_at, v.created_at), v.visited_by, NULL::uuid,
       'Store visit', left(COALESCE(v.notes,''), 240), v.status,
       COALESCE(v.status, '') NOT IN ('completed','cancelled','canceled'), NULL::text, true
FROM public.store_visits v
WHERE v.store_id IS NOT NULL

UNION ALL
SELECT 'delivery:' || d.id::text, d.store_id, 'delivery', d.delivery_type,
       COALESCE(d.completed_at, d.failed_at, d.scheduled_date::timestamptz, d.created_at),
       COALESCE(d.assigned_driver_id, d.created_by_user_id), NULL::uuid,
       CASE WHEN d.completed_at IS NOT NULL THEN 'Delivery completed'
            WHEN d.failed_at IS NOT NULL THEN 'Delivery failed'
            ELSE 'Delivery scheduled' END,
       left(COALESCE(d.special_instructions, d.dispatcher_notes, ''), 240),
       d.status,
       COALESCE(d.status,'') NOT IN ('completed','delivered','failed','cancelled','canceled'),
       NULL::text, true
FROM public.deliveries d
WHERE d.store_id IS NOT NULL

UNION ALL
SELECT 'route_stop:' || rs.id::text, rs.store_id, 'route', rs.stop_reason,
       COALESCE(rs.actual_arrival, rs.created_at), NULL::uuid, NULL::uuid,
       CASE WHEN rs.actual_arrival IS NOT NULL THEN 'Route stop completed' ELSE 'Route stop planned' END,
       left(COALESCE(rs.notes, rs.notes_to_worker, ''), 240), rs.status,
       COALESCE(rs.status,'') NOT IN ('completed','skipped','cancelled','canceled'), NULL::text, true
FROM public.route_stops rs
WHERE rs.store_id IS NOT NULL

UNION ALL
SELECT 'order:' || o.id::text, o.store_id, 'order', o.order_type::text,
       COALESCE(o.completed_at, o.placed_at, o.created_at), COALESCE(o.created_by, o.assigned_to), NULL::uuid,
       CASE WHEN o.completed_at IS NOT NULL THEN 'Order completed' ELSE 'Order ' || COALESCE(o.order_status::text,'created') END,
       left(COALESCE(o.internal_notes, o.customer_notes, ''), 240),
       o.order_status::text,
       COALESCE(o.order_status::text,'') NOT IN ('completed','delivered','cancelled','canceled','refunded'),
       NULL::text, true
FROM public.orders o
WHERE o.store_id IS NOT NULL AND o.deleted_at IS NULL

UNION ALL
SELECT 'sample_given:' || s.id::text, s.store_id, 'samples', 'given',
       COALESCE(s.given_at, s.created_at), s.given_by, NULL::uuid,
       'Samples given' || COALESCE(' (' || s.brand || ')', ''),
       left(COALESCE(s.note,''), 240), 'given', false, NULL::text, true
FROM public.store_samples_given s
WHERE s.store_id IS NOT NULL

UNION ALL
SELECT 'sample_check:' || s.id::text, s.store_id, 'samples', 'check',
       COALESCE(s.checked_at, s.created_at), s.checked_by, NULL::uuid,
       'Sample check' || COALESCE(' (' || s.brand || ')', ''),
       left(COALESCE(s.note,''), 240), 'checked', false, NULL::text, true
FROM public.store_sample_checks s
WHERE s.store_id IS NOT NULL

UNION ALL
SELECT 'followup:' || f.id::text, f.store_id, 'followup', f.reason,
       COALESCE(f.completed_at, f.due_at, f.created_at), f.completed_by, NULL::uuid,
       CASE WHEN f.status = 'completed' THEN 'Follow-up completed' ELSE 'Follow-up ' || COALESCE(f.status,'open') END,
       left(COALESCE(f.recommended_action, f.reason, ''), 240), f.status,
       COALESCE(f.status,'') NOT IN ('completed','cancelled','canceled','dismissed'), NULL::text, true
FROM public.follow_up_queue f
WHERE f.store_id IS NOT NULL

UNION ALL
SELECT 'inventory:' || i.id::text, i.store_id, 'inventory', i.brand,
       COALESCE(i.last_checked_at, i.last_updated), NULL::uuid, NULL::uuid,
       'Inventory updated' || COALESCE(' (' || i.brand || ')', ''),
       'Tubes left: ' || COALESCE(i.current_tubes_left::text, 'n/a'),
       CASE WHEN i.needs_operator_verification THEN 'needs_verification' ELSE 'recorded' END,
       COALESCE(i.needs_operator_verification, false), NULL::text, true
FROM public.store_tube_inventory i
WHERE i.store_id IS NOT NULL AND COALESCE(i.is_simulation, false) = false

UNION ALL
SELECT 'invoice:' || inv.id::text, inv.store_id, 'invoice', inv.payment_status,
       COALESCE(inv.paid_at, inv.created_at), NULL::uuid, NULL::uuid,
       CASE WHEN inv.paid_at IS NOT NULL THEN 'Invoice paid' ELSE 'Invoice ' || COALESCE(inv.payment_status,'created') END,
       COALESCE('#' || inv.invoice_number, '') || COALESCE(' · $' || round(inv.total_amount, 2)::text, ''),
       inv.payment_status,
       COALESCE(inv.payment_status,'') NOT IN ('paid','void','voided','cancelled','canceled'),
       NULL::text, true
FROM public.invoices inv
WHERE inv.store_id IS NOT NULL AND inv.deleted_at IS NULL

UNION ALL
SELECT 'field:' || fs.id::text, fs.store_id, 'field', fs.entity_type::text,
       fs.created_at, fs.submitted_by_user_id, NULL::uuid,
       'Field update: ' || fs.action_type::text || ' ' || fs.entity_type::text,
       left(COALESCE(fs.admin_notes, fs.amendment_notes, ''), 240),
       fs.submission_status::text,
       (fs.submission_status::text = 'pending_review'), NULL::text, true
FROM public.field_submissions fs
WHERE fs.store_id IS NOT NULL;

GRANT SELECT ON public.v_store_activity TO authenticated;
GRANT ALL ON public.v_store_activity TO service_role;
