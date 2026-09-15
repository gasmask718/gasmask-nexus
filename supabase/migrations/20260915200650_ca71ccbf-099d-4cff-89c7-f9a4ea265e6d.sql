CREATE OR REPLACE VIEW public.v_store_activity AS
 WITH review_ranked AS (
         SELECT r.id, r.store_id, r.review_type, r.action, r.reviewed_by, r.reviewed_at, r.note, r.created_at,
            row_number() OVER (PARTITION BY r.store_id, r.review_type ORDER BY r.reviewed_at DESC, r.created_at DESC) AS rn
           FROM store_review_events r
        )
 SELECT 'review:'::text || r.id::text AS activity_id, r.store_id,
        CASE WHEN r.rn = 1 THEN 'review'::text ELSE 'review_audit'::text END AS kind,
    r.review_type AS subtype, COALESCE(r.reviewed_at, r.created_at) AS occurred_at, r.reviewed_by AS actor_id,
    NULL::uuid AS contact_id,
        CASE WHEN r.action = 'reviewed'::text THEN ('Marked reviewed ('::text || r.review_type) || ')'::text
             ELSE ('Review removed ('::text || r.review_type) || ')'::text END AS title,
    r.note AS detail, r.action AS status, false AS is_open, NULL::text AS direction, r.rn = 1 AS is_current
   FROM review_ranked r
UNION ALL
 SELECT 'note:'::text || n.id::text, n.store_id, 'note'::text, COALESCE(n.brand_scope, 'note'::text),
    COALESCE(n.edited_at, n.created_at), n.created_by, NULL::uuid,
        CASE WHEN n.edited_at IS NOT NULL THEN 'Note edited'::text ELSE 'Note added'::text END,
    "left"(COALESCE(n.note_text, ''::text), 240), 'logged'::text, false, NULL::text, true
   FROM store_notes n
  WHERE n.deleted_at IS NULL AND n.store_id IS NOT NULL
UNION ALL
 SELECT (('comm:'::text || c.source_table) || ':'::text) || c.source_id, c.store_id,
        CASE WHEN c.channel = 'sms'::text THEN 'text'::text ELSE 'call'::text END,
        CASE WHEN c.is_ai THEN 'ai'::text ELSE 'human'::text END,
    c.occurred_at, NULL::uuid, c.contact_id,
        CASE WHEN c.channel = 'sms'::text AND c.direction = 'inbound'::text THEN 'Inbound reply'::text
             WHEN c.channel = 'sms'::text THEN 'Text sent'::text
             WHEN c.is_ai THEN 'Call answered by AI'::text
             WHEN COALESCE(c.status, c.outcome) = ANY (ARRAY['no-answer'::text,'no_answer'::text,'missed'::text,'busy'::text,'failed'::text,'canceled'::text,'cancelled'::text,'voicemail'::text]) THEN 'Missed / unanswered call'::text
             WHEN c.direction = 'inbound'::text THEN 'Inbound call'::text
             ELSE 'Outbound call'::text END,
    "left"(COALESCE(c.summary, c.body, c.transcript, ''::text), 240), COALESCE(c.outcome, c.status),
        CASE WHEN c.channel = 'sms'::text AND c.direction = 'inbound'::text THEN cl.read_at IS NULL
             WHEN c.channel <> 'sms'::text AND (COALESCE(c.status, c.outcome) = ANY (ARRAY['no-answer'::text,'no_answer'::text,'missed'::text,'busy'::text,'failed'::text,'canceled'::text,'cancelled'::text,'voicemail'::text])) THEN cl.handled_at IS NULL
             ELSE false END,
    c.direction, true
   FROM v_store_comms_detail c
     LEFT JOIN communication_logs cl ON c.source_table = 'communication_logs'::text AND cl.id::text = c.source_id
  WHERE c.store_id IS NOT NULL
UNION ALL
 SELECT 'visit:'::text || v.id::text, v.store_id, 'visit'::text, v.visit_type,
    COALESCE(v.completed_at, v.started_at, v.created_at), v.visited_by, NULL::uuid, 'Store visit'::text,
    "left"(COALESCE(v.notes, ''::text), 240), v.status,
    COALESCE(v.status, ''::text) <> ALL (ARRAY['completed'::text,'cancelled'::text,'canceled'::text]),
    NULL::text, true
   FROM store_visits v
  WHERE v.store_id IS NOT NULL
UNION ALL
 SELECT 'delivery:'::text || d.id::text, d.store_id, 'delivery'::text, d.delivery_type,
    COALESCE(d.completed_at, d.failed_at, d.scheduled_date::timestamp with time zone, d.created_at),
    COALESCE(d.assigned_driver_id, d.created_by_user_id), NULL::uuid,
        CASE WHEN d.completed_at IS NOT NULL THEN 'Delivery completed'::text
             WHEN d.failed_at IS NOT NULL THEN 'Delivery failed'::text
             ELSE 'Delivery scheduled'::text END,
    "left"(COALESCE(d.special_instructions, d.dispatcher_notes, ''::text), 240), d.status,
    COALESCE(d.status, ''::text) <> ALL (ARRAY['completed'::text,'delivered'::text,'failed'::text,'cancelled'::text,'canceled'::text]),
    NULL::text, true
   FROM deliveries d
  WHERE d.store_id IS NOT NULL
UNION ALL
 SELECT 'route_stop:'::text || rs.id::text, rs.store_id, 'route'::text, rs.stop_reason,
    COALESCE(rs.actual_arrival, rs.created_at), NULL::uuid, NULL::uuid,
        CASE WHEN rs.actual_arrival IS NOT NULL THEN 'Route stop completed'::text ELSE 'Route stop planned'::text END,
    "left"(COALESCE(rs.notes, rs.notes_to_worker, ''::text), 240), rs.status,
    COALESCE(rs.status, ''::text) <> ALL (ARRAY['completed'::text,'skipped'::text,'cancelled'::text,'canceled'::text]),
    NULL::text, true
   FROM route_stops rs
  WHERE rs.store_id IS NOT NULL
UNION ALL
 SELECT 'order:'::text || o.id::text, o.store_id, 'order'::text, o.order_type::text,
    COALESCE(o.completed_at, o.placed_at, o.created_at), COALESCE(o.created_by, o.assigned_to), NULL::uuid,
        CASE WHEN o.completed_at IS NOT NULL THEN 'Order completed'::text
             ELSE 'Order '::text || COALESCE(o.order_status::text, 'created'::text) END,
    "left"(COALESCE(o.internal_notes, o.customer_notes, ''::text), 240), o.order_status::text,
    COALESCE(o.order_status::text, ''::text) <> ALL (ARRAY['completed'::text,'delivered'::text,'cancelled'::text,'canceled'::text,'refunded'::text]),
    NULL::text, true
   FROM orders o
  WHERE o.store_id IS NOT NULL AND o.deleted_at IS NULL
UNION ALL
 SELECT 'sample_given:'::text || s.id::text, s.store_id, 'samples'::text, 'given'::text,
    COALESCE(s.given_at, s.created_at), s.given_by, NULL::uuid,
    'Samples given'::text || COALESCE((' ('::text || s.brand) || ')'::text, ''::text),
    "left"(COALESCE(s.note, ''::text), 240), 'given'::text, false, NULL::text, true
   FROM store_samples_given s
  WHERE s.store_id IS NOT NULL
UNION ALL
 SELECT 'sample_check:'::text || s.id::text, s.store_id, 'samples'::text, 'check'::text,
    COALESCE(s.checked_at, s.created_at), s.checked_by, NULL::uuid,
    'Sample check'::text || COALESCE((' ('::text || s.brand) || ')'::text, ''::text),
    "left"(COALESCE(s.note, ''::text), 240), 'checked'::text, false, NULL::text, true
   FROM store_sample_checks s
  WHERE s.store_id IS NOT NULL
UNION ALL
 SELECT 'followup:'::text || f.id::text, f.store_id, 'followup'::text, f.reason,
    COALESCE(f.completed_at, f.due_at, f.created_at), f.completed_by, NULL::uuid,
        CASE WHEN f.status = 'completed'::text THEN 'Follow-up completed'::text
             ELSE 'Follow-up '::text || COALESCE(f.status, 'open'::text) END,
    "left"(COALESCE(f.recommended_action, f.reason, ''::text), 240), f.status,
    COALESCE(f.status, ''::text) <> ALL (ARRAY['completed'::text,'cancelled'::text,'canceled'::text,'dismissed'::text]),
    NULL::text, true
   FROM follow_up_queue f
  WHERE f.store_id IS NOT NULL
UNION ALL
 SELECT 'inventory:'::text || i.id::text, i.store_id, 'inventory'::text, i.brand,
    COALESCE(i.last_checked_at, i.last_updated), NULL::uuid, NULL::uuid,
    'Inventory updated'::text || COALESCE((' ('::text || i.brand) || ')'::text, ''::text),
    'Tubes left: '::text || COALESCE(i.current_tubes_left::text, 'n/a'::text),
        CASE WHEN i.needs_operator_verification THEN 'needs_verification'::text ELSE 'recorded'::text END,
    COALESCE(i.needs_operator_verification, false), NULL::text, true
   FROM store_tube_inventory i
  WHERE i.store_id IS NOT NULL AND COALESCE(i.is_simulation, false) = false
UNION ALL
 SELECT 'invoice:'::text || inv.id::text, inv.store_id, 'invoice'::text, inv.payment_status,
    COALESCE(inv.paid_at, inv.created_at), NULL::uuid, NULL::uuid,
        CASE WHEN inv.paid_at IS NOT NULL THEN 'Invoice paid'::text
             ELSE 'Invoice '::text || COALESCE(inv.payment_status, 'created'::text) END,
    COALESCE('#'::text || inv.invoice_number, ''::text) || COALESCE(' · $'::text || round(inv.total_amount, 2)::text, ''::text),
    inv.payment_status,
    COALESCE(inv.payment_status, ''::text) <> ALL (ARRAY['paid'::text,'void'::text,'voided'::text,'cancelled'::text,'canceled'::text]),
    NULL::text, true
   FROM invoices inv
  WHERE inv.store_id IS NOT NULL AND inv.deleted_at IS NULL
UNION ALL
 SELECT 'field:'::text || fs.id::text, fs.store_id, 'field'::text, fs.entity_type::text, fs.created_at,
    fs.submitted_by_user_id, NULL::uuid,
    (('Field update: '::text || fs.action_type::text) || ' '::text) || fs.entity_type::text,
    "left"(COALESCE(fs.admin_notes, fs.amendment_notes, ''::text), 240), fs.submission_status::text,
    fs.submission_status::text = 'pending_review'::text, NULL::text, true
   FROM field_submissions fs
  WHERE fs.store_id IS NOT NULL
UNION ALL
 SELECT 'claim_secured:'::text || cl2.id::text, cl2.store_id, 'claim'::text, 'secured'::text,
    COALESCE(cl2.secured_at, cl2.created_at), cl2.secured_by_user_id, NULL::uuid,
    'Store secured'::text, NULL::text,
        CASE WHEN cl2.released_at IS NULL THEN 'secured'::text ELSE 'released'::text END,
    false, NULL::text, cl2.released_at IS NULL
   FROM ambassador_store_claims cl2
  WHERE cl2.store_id IS NOT NULL
UNION ALL
 SELECT 'claim_released:'::text || cl3.id::text, cl3.store_id, 'claim'::text, 'released'::text,
    cl3.released_at, cl3.released_by_user_id, NULL::uuid,
    'Store released'::text, "left"(COALESCE(cl3.release_reason, ''::text), 240), 'released'::text,
    false, NULL::text, true
   FROM ambassador_store_claims cl3
  WHERE cl3.store_id IS NOT NULL AND cl3.released_at IS NOT NULL
UNION ALL
 SELECT 'status:'::text || sh.id::text, sh.store_id, 'status'::text, sh.event_type, sh.created_at,
    sh.created_by, NULL::uuid,
    'Status change: '::text || COALESCE(sh.event_type, 'updated'::text),
    "left"(COALESCE(sh.description, ''::text), 240), sh.event_type, false, NULL::text, true
   FROM store_status_history sh
  WHERE sh.store_id IS NOT NULL;