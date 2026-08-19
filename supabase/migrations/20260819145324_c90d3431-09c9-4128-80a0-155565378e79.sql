-- 1) Add store_id to the unified touch stream.
DROP VIEW IF EXISTS public.v_comms_touch_stream;
CREATE VIEW public.v_comms_touch_stream
WITH (security_invoker = on) AS
WITH src AS (
  SELECT 'communication_logs'::text AS source_table, cl.id::text AS source_id,
         COALESCE(cl.sent_at, cl.started_at, cl.created_at) AS occurred_at,
         LOWER(COALESCE(cl.channel,'unknown')) AS channel,
         LOWER(COALESCE(cl.direction,'unknown')) AS direction,
         COALESCE(cl.recipient_phone, cl.sender_phone) AS phone_raw,
         COALESCE(cl.outcome, cl.status, cl.delivery_status) AS outcome,
         COALESCE(cl.brand, 'gasmask') AS business_unit,
         COALESCE(cl.twilio_sid, cl.twilio_call_sid, cl.bland_call_id, cl.provider_message_id) AS provider_sid,
         COALESCE(
           cl.store_id,
           CASE WHEN cl.source_table IN ('stores','store_master')
                     AND cl.source_id::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                THEN cl.source_id::text::uuid END,
           CASE WHEN cl.linked_entity_type = 'store'
                     AND cl.linked_entity_id::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                THEN cl.linked_entity_id::uuid END
         ) AS store_id
  FROM public.communication_logs cl
  UNION ALL
  SELECT 'va_call_logs', v.id::text, COALESCE(v.called_at, v.wrap_up_completed_at), 'call',
         LOWER(COALESCE(v.direction,'outbound')),
         COALESCE(v.to_number, m.phone), COALESCE(v.disposition, v.call_status), 'brandaro', v.call_sid,
         NULL::uuid
  FROM public.va_call_logs v
  LEFT JOIN public.brandaro_leads_master m ON m.id = v.lead_id
  UNION ALL
  SELECT 'dynasty_ai_calls', d.id::text, COALESCE(d.call_started_at, d.created_at), 'call',
         LOWER(COALESCE(d.direction,'outbound')),
         CASE WHEN LOWER(COALESCE(d.direction,'outbound')) = 'inbound' THEN COALESCE(d.from_number, d.to_number)
              ELSE COALESCE(d.to_number, d.from_number) END,
         d.outcome, COALESCE(d.business_unit,'dynasty'), d.call_id,
         CASE WHEN d.source_table IN ('stores','store_master')
                   AND d.source_id::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
              THEN d.source_id::text::uuid END
  FROM public.dynasty_ai_calls d
  UNION ALL
  SELECT 'dc_call_logs', c.id::text, c.created_at, 'call',
         LOWER(COALESCE(c.direction,'outbound')),
         CASE WHEN LOWER(COALESCE(c.direction,'outbound')) = 'inbound' THEN COALESCE(c.from_number, c.to_number)
              ELSE COALESCE(c.to_number, c.from_number) END,
         COALESCE(c.outcome, c.status), COALESCE(c.business,'dynasty_connect'), c.call_sid,
         CASE WHEN c.source_table IN ('stores','store_master')
                   AND c.source_id::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
              THEN c.source_id::text::uuid END
  FROM public.dc_call_logs c
  UNION ALL
  SELECT 'manual_call_logs', mc.id::text, COALESCE(mc.started_at, mc.created_at), 'call',
         LOWER(COALESCE(mc.direction,'outbound')),
         COALESCE(mc.phone_number, mc.to_number, mc.from_number),
         COALESCE(mc.outcome, mc.status), 'gasmask', NULL,
         mc.store_id
  FROM public.manual_call_logs mc
  WHERE COALESCE(mc.is_test_call, false) = false
  UNION ALL
  SELECT 'twilio_call_logs', t.id::text, t.created_at, 'call',
         LOWER(COALESCE(t.direction,'unknown')),
         CASE WHEN LOWER(COALESCE(t.direction,'')) LIKE 'inbound%' THEN COALESCE(t.from_number, t.to_number)
              ELSE COALESCE(t.to_number, t.from_number) END,
         t.status, 'gasmask', t.call_sid,
         NULL::uuid
  FROM public.twilio_call_logs t
  UNION ALL
  SELECT 'outbound_messages', o.id::text, COALESCE(o.sent_at, o.created_at), 'sms', 'outbound',
         o.to_number, COALESCE(o.status, o.error_code), 'gasmask', o.provider_message_id,
         o.store_id
  FROM public.outbound_messages o
  UNION ALL
  SELECT 'messaging_messages', mm.id::text, mm.created_at, 'sms',
         LOWER(COALESCE(mm.direction,'outbound')), mm.phone, mm.status, 'gasmask', mm.twilio_sid,
         mm.store_id
  FROM public.messaging_messages mm
  UNION ALL
  SELECT 'sbo_sms_log', s.id::text, s.created_at, 'sms',
         LOWER(COALESCE(s.direction,'outbound')), s.phone_number,
         CASE WHEN s.processed THEN 'processed' ELSE NULL END, 'sbo', s.twilio_sid,
         NULL::uuid
  FROM public.sbo_sms_log s
  UNION ALL
  SELECT 'brandaro_ai_calls', b.id::text, COALESCE(b.called_at, b.created_at), 'call', 'outbound',
         bl.phone, COALESCE(b.status, b.outcome), 'brandaro', b.call_sid,
         NULL::uuid
  FROM public.brandaro_ai_calls b
  LEFT JOIN public.brandaro_leads_master bl ON bl.id = b.lead_id
  UNION ALL
  SELECT 'bland_call_logs', bc.id::text, bc.created_at, 'call', 'outbound',
         blz.phone_number, bc.call_outcome, COALESCE(bc.source_business,'dynasty'), bc.call_id,
         CASE WHEN bc.source_table IN ('stores','store_master')
                   AND bc.source_id::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
              THEN bc.source_id::text::uuid END
  FROM public.bland_call_logs bc
  LEFT JOIN public.bland_leads blz ON blz.id = bc.lead_id
  UNION ALL
  SELECT 'communication_events', ce.id::text, ce.created_at,
         LOWER(COALESCE(ce.channel,'unknown')), LOWER(COALESCE(ce.direction,'unknown')),
         ce.external_contact, ce.event_type, 'gasmask', NULL,
         COALESCE(
           ce.store_id,
           CASE WHEN ce.linked_entity_type = 'store'
                     AND ce.linked_entity_id::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                THEN ce.linked_entity_id::uuid END
         )
  FROM public.communication_events ce
)
SELECT
  src.source_table,
  src.source_id,
  src.occurred_at,
  src.channel,
  src.direction,
  CASE WHEN src.phone_raw ~ '[0-9]' THEN src.phone_raw END AS phone_e164,
  NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(src.phone_raw,''), '[^0-9]', '', 'g'), 10), '') AS phone_last10,
  src.outcome,
  src.business_unit,
  src.provider_sid,
  src.store_id
FROM src;

REVOKE ALL ON public.v_comms_touch_stream FROM anon;
GRANT SELECT ON public.v_comms_touch_stream TO authenticated;
GRANT SELECT ON public.v_comms_touch_stream TO service_role;

-- 2) Store-scoped detail view: one SQL merge replacing four client-side merges.
CREATE OR REPLACE VIEW public.v_store_comms_detail
WITH (security_invoker = on) AS
SELECT
  cl.store_id,
  cl.contact_id,
  'communication_logs'::text AS source_table,
  cl.id::text AS source_id,
  COALESCE(cl.started_at, cl.sent_at, cl.created_at) AS occurred_at,
  LOWER(COALESCE(cl.channel,'note')) AS channel,
  LOWER(COALESCE(cl.direction,'outbound')) AS direction,
  COALESCE(cl.status, cl.delivery_status) AS status,
  cl.outcome,
  COALESCE(cl.duration_seconds, cl.call_duration) AS duration_seconds,
  CASE WHEN LOWER(COALESCE(cl.direction,'outbound')) = 'inbound'
       THEN COALESCE(cl.sender_phone, cl.recipient_phone)
       ELSE COALESCE(cl.recipient_phone, cl.sender_phone) END AS phone,
  cl.summary,
  COALESCE(cl.message_content, cl.full_message) AS body,
  COALESCE(cl.transcript, cl.transcription) AS transcript,
  cl.recording_url,
  cl.performed_by,
  (COALESCE(cl.ai_assisted,false) OR COALESCE(cl.bland_ai_handled,false)) AS is_ai,
  COALESCE(cl.twilio_call_sid, cl.twilio_sid, cl.bland_call_id) AS provider_sid
FROM public.communication_logs cl
WHERE cl.store_id IS NOT NULL

UNION ALL
SELECT cm.store_id, cm.contact_id, 'communication_messages', cm.id::text, cm.created_at,
       LOWER(COALESCE(cm.channel,'sms')), LOWER(COALESCE(cm.direction,'outbound')),
       cm.status, NULL, NULL,
       COALESCE(cm.phone_number, cm.to_number, cm.from_number),
       NULL, cm.content, NULL, NULL, cm.actor_type,
       COALESCE(cm.ai_generated,false), cm.provider_message_id
FROM public.communication_messages cm
WHERE cm.store_id IS NOT NULL

UNION ALL
SELECT mc.store_id, NULL::uuid, 'manual_call_logs', mc.id::text,
       COALESCE(mc.started_at, mc.created_at), 'call',
       LOWER(COALESCE(mc.direction,'outbound')), mc.status, mc.outcome, mc.duration_seconds,
       COALESCE(mc.phone_number, mc.to_number, mc.from_number),
       mc.notes, NULL, NULL, NULL, NULL, false, NULL
FROM public.manual_call_logs mc
WHERE mc.store_id IS NOT NULL AND COALESCE(mc.is_test_call,false) = false

UNION ALL
SELECT mm.store_id, NULL::uuid, 'messaging_messages', mm.id::text, mm.created_at, 'sms',
       LOWER(COALESCE(mm.direction,'outbound')), mm.status, NULL, NULL,
       mm.phone, NULL, mm.body, NULL, NULL, NULL,
       COALESCE(mm.ai_generated,false), mm.twilio_sid
FROM public.messaging_messages mm
WHERE mm.store_id IS NOT NULL

UNION ALL
SELECT om.store_id, NULL::uuid, 'outbound_messages', om.id::text,
       COALESCE(om.sent_at, om.created_at), 'sms', 'outbound',
       COALESCE(om.status, om.error_code), NULL, NULL,
       om.to_number, NULL, om.message_body, NULL, NULL, NULL, false, om.provider_message_id
FROM public.outbound_messages om
WHERE om.store_id IS NOT NULL

UNION ALL
SELECT sc.store_id, sc.id, 'dynasty_ai_calls', d.id::text,
       COALESCE(d.call_started_at, d.created_at), 'call',
       LOWER(COALESCE(d.direction,'outbound')), d.outcome, d.outcome, d.duration_seconds,
       CASE WHEN LOWER(COALESCE(d.direction,'outbound')) = 'inbound'
            THEN COALESCE(d.from_number, d.to_number)
            ELSE COALESCE(d.to_number, d.from_number) END,
       CASE WHEN d.agent_name IS NOT NULL THEN 'AI agent: ' || d.agent_name END,
       NULL, d.transcript, d.recording_url, d.agent_name, true, d.call_id
FROM public.dynasty_ai_calls d
JOIN public.store_contacts sc
  ON sc.deleted_at IS NULL
 AND NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(sc.phone,''), '[^0-9]', '', 'g'), 10), '') =
     NULLIF(RIGHT(REGEXP_REPLACE(
       COALESCE(CASE WHEN LOWER(COALESCE(d.direction,'outbound')) = 'inbound'
                     THEN COALESCE(d.from_number, d.to_number)
                     ELSE COALESCE(d.to_number, d.from_number) END, ''),
       '[^0-9]', '', 'g'), 10), '');

REVOKE ALL ON public.v_store_comms_detail FROM anon;
GRANT SELECT ON public.v_store_comms_detail TO authenticated;
GRANT SELECT ON public.v_store_comms_detail TO service_role;

INSERT INTO public.public_view_contracts (view_name, allowed_privileges, public_roles, forbidden_columns, notes)
VALUES (
  'v_store_comms_detail',
  ARRAY['SELECT'],
  ARRAY[]::text[],
  ARRAY['recording_url'],
  'Authenticated-only store comms merge (bodies + transcripts + recording pointers). Never exposed to anon; recordings play only through play-twilio-recording.'
)
ON CONFLICT (view_name) DO UPDATE
  SET allowed_privileges = EXCLUDED.allowed_privileges,
      public_roles = EXCLUDED.public_roles,
      forbidden_columns = EXCLUDED.forbidden_columns,
      notes = EXCLUDED.notes;