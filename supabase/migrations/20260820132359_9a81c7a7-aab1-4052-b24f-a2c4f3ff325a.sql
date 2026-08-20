CREATE INDEX IF NOT EXISTS idx_store_contacts_phone_last10
  ON public.store_contacts ((RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10)))
  WHERE deleted_at IS NULL AND store_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stores_phone_last10
  ON public.stores ((RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10)));

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
),
-- Unique-match phone maps. A number owned by more than one store resolves to
-- NOTHING: an unresolved touch stays visible with a NULL store_id rather than
-- being silently attached to the wrong store.
contact_map AS (
  SELECT NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(sc.phone,''), '[^0-9]', '', 'g'), 10), '') AS k,
         MIN(sc.store_id::text)::uuid AS store_id
  FROM public.store_contacts sc
  WHERE sc.deleted_at IS NULL AND sc.store_id IS NOT NULL AND sc.phone IS NOT NULL
  GROUP BY 1
  HAVING COUNT(DISTINCT sc.store_id) = 1
),
store_map AS (
  SELECT NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(st.phone,''), '[^0-9]', '', 'g'), 10), '') AS k,
         MIN(st.id::text)::uuid AS store_id
  FROM public.stores st
  WHERE st.phone IS NOT NULL
  GROUP BY 1
  HAVING COUNT(DISTINCT st.id) = 1
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
  COALESCE(
    src.store_id,
    cm.store_id,
    -- Store main-line fallback is skipped for the betting line: the owner's
    -- personal number is also a store phone there, so it would drag unrelated
    -- SBO traffic onto that store's profile.
    CASE WHEN src.source_table <> 'sbo_sms_log' AND src.business_unit <> 'sbo'
         THEN sm.store_id END
  ) AS store_id,
  CASE
    WHEN src.store_id IS NOT NULL THEN 'row'
    WHEN cm.store_id IS NOT NULL THEN 'contact_phone'
    WHEN src.source_table <> 'sbo_sms_log' AND src.business_unit <> 'sbo' AND sm.store_id IS NOT NULL THEN 'store_phone'
    ELSE NULL
  END AS store_id_source
FROM src
LEFT JOIN contact_map cm
  ON cm.k = NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(src.phone_raw,''), '[^0-9]', '', 'g'), 10), '')
LEFT JOIN store_map sm
  ON sm.k = NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(src.phone_raw,''), '[^0-9]', '', 'g'), 10), '');

REVOKE ALL ON public.v_comms_touch_stream FROM anon;
GRANT SELECT ON public.v_comms_touch_stream TO authenticated;
GRANT SELECT ON public.v_comms_touch_stream TO service_role;

UPDATE public.public_view_contracts
   SET notes = 'Unified communications touch stream. Read-only, authenticated only (never anon - contains phone numbers). Recording URLs and message bodies are permanently out of contract. Rows with a NULL phone stay visible; never filter them out. store_id is best-effort: row-level id, then a UNIQUE store_contacts phone match, then a UNIQUE stores.phone match (never for sbo traffic); ambiguous numbers resolve to NULL and stay visible. store_id_source records which step matched. New touch sources are added by extending this view, not by creating another log table.'
 WHERE view_name = 'v_comms_touch_stream';