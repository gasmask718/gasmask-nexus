-- 1) Quarantine health probes out of bland_call_logs (evidence preserved)
CREATE TABLE IF NOT EXISTS public.bland_call_logs_quarantine (LIKE public.bland_call_logs INCLUDING DEFAULTS);
ALTER TABLE public.bland_call_logs_quarantine ADD COLUMN IF NOT EXISTS quarantined_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.bland_call_logs_quarantine ADD COLUMN IF NOT EXISTS quarantine_reason text NOT NULL DEFAULT 'health_probe';
GRANT SELECT ON public.bland_call_logs_quarantine TO authenticated;
GRANT ALL ON public.bland_call_logs_quarantine TO service_role;
ALTER TABLE public.bland_call_logs_quarantine ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read bland quarantine" ON public.bland_call_logs_quarantine;
CREATE POLICY "Authenticated read bland quarantine" ON public.bland_call_logs_quarantine
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Service role full bland quarantine" ON public.bland_call_logs_quarantine;
CREATE POLICY "Service role full bland quarantine" ON public.bland_call_logs_quarantine
  TO service_role USING (true) WITH CHECK (true);

WITH moved AS (
  DELETE FROM public.bland_call_logs b
  WHERE b.raw_payload->>'healthcheck' = 'true'
     OR b.call_id ~ '^health_[0-9]{10,}$'
  RETURNING b.*
)
INSERT INTO public.bland_call_logs_quarantine (
  id, lead_id, agent_type, call_id, transcript, recording_url, call_outcome, raw_payload,
  created_at, delivery_requested, preferred_day, preferred_window, urgency, intent_summary,
  is_reactivation_lead, structured_outcome_received_at, source_table, source_id, source_business
)
SELECT id, lead_id, agent_type, call_id, transcript, recording_url, call_outcome, raw_payload,
       created_at, delivery_requested, preferred_day, preferred_window, urgency, intent_summary,
       is_reactivation_lead, structured_outcome_received_at, source_table, source_id, source_business
FROM moved;

-- 2) Unified touch stream (view, not table — no writers to forget)
CREATE OR REPLACE VIEW public.v_comms_touch_stream
WITH (security_invoker = on) AS
WITH src AS (
  SELECT 'communication_logs'::text AS source_table, cl.id::text AS source_id,
         COALESCE(cl.sent_at, cl.started_at, cl.created_at) AS occurred_at,
         LOWER(COALESCE(cl.channel,'unknown')) AS channel,
         LOWER(COALESCE(cl.direction,'unknown')) AS direction,
         COALESCE(cl.recipient_phone, cl.sender_phone) AS phone_raw,
         COALESCE(cl.outcome, cl.status, cl.delivery_status) AS outcome,
         COALESCE(cl.brand, 'gasmask') AS business_unit,
         COALESCE(cl.twilio_sid, cl.twilio_call_sid, cl.bland_call_id, cl.provider_message_id) AS provider_sid
  FROM public.communication_logs cl
  UNION ALL
  SELECT 'va_call_logs', v.id::text, COALESCE(v.called_at, v.wrap_up_completed_at), 'call',
         LOWER(COALESCE(v.direction,'outbound')),
         COALESCE(v.to_number, m.phone), COALESCE(v.disposition, v.call_status), 'brandaro', v.call_sid
  FROM public.va_call_logs v
  LEFT JOIN public.brandaro_leads_master m ON m.id = v.lead_id
  UNION ALL
  SELECT 'dynasty_ai_calls', d.id::text, COALESCE(d.call_started_at, d.created_at), 'call',
         LOWER(COALESCE(d.direction,'outbound')),
         CASE WHEN LOWER(COALESCE(d.direction,'outbound')) = 'inbound' THEN COALESCE(d.from_number, d.to_number)
              ELSE COALESCE(d.to_number, d.from_number) END,
         d.outcome, COALESCE(d.business_unit,'dynasty'), d.call_id
  FROM public.dynasty_ai_calls d
  UNION ALL
  SELECT 'dc_call_logs', c.id::text, c.created_at, 'call',
         LOWER(COALESCE(c.direction,'outbound')),
         CASE WHEN LOWER(COALESCE(c.direction,'outbound')) = 'inbound' THEN COALESCE(c.from_number, c.to_number)
              ELSE COALESCE(c.to_number, c.from_number) END,
         COALESCE(c.outcome, c.status), COALESCE(c.business,'dynasty_connect'), c.call_sid
  FROM public.dc_call_logs c
  UNION ALL
  SELECT 'manual_call_logs', mc.id::text, COALESCE(mc.started_at, mc.created_at), 'call',
         LOWER(COALESCE(mc.direction,'outbound')),
         COALESCE(mc.phone_number, mc.to_number, mc.from_number),
         COALESCE(mc.outcome, mc.status), 'gasmask', NULL
  FROM public.manual_call_logs mc
  WHERE COALESCE(mc.is_test_call, false) = false
  UNION ALL
  SELECT 'twilio_call_logs', t.id::text, t.created_at, 'call',
         LOWER(COALESCE(t.direction,'unknown')),
         CASE WHEN LOWER(COALESCE(t.direction,'')) LIKE 'inbound%' THEN COALESCE(t.from_number, t.to_number)
              ELSE COALESCE(t.to_number, t.from_number) END,
         t.status, 'gasmask', t.call_sid
  FROM public.twilio_call_logs t
  UNION ALL
  SELECT 'outbound_messages', o.id::text, COALESCE(o.sent_at, o.created_at), 'sms', 'outbound',
         o.to_number, COALESCE(o.status, o.error_code), 'gasmask', o.provider_message_id
  FROM public.outbound_messages o
  UNION ALL
  SELECT 'messaging_messages', mm.id::text, mm.created_at, 'sms',
         LOWER(COALESCE(mm.direction,'outbound')), mm.phone, mm.status, 'gasmask', mm.twilio_sid
  FROM public.messaging_messages mm
  UNION ALL
  SELECT 'sbo_sms_log', s.id::text, s.created_at, 'sms',
         LOWER(COALESCE(s.direction,'outbound')), s.phone_number,
         CASE WHEN s.processed THEN 'processed' ELSE NULL END, 'sbo', s.twilio_sid
  FROM public.sbo_sms_log s
  UNION ALL
  SELECT 'brandaro_ai_calls', b.id::text, COALESCE(b.called_at, b.created_at), 'call', 'outbound',
         bl.phone, COALESCE(b.status, b.outcome), 'brandaro', b.call_sid
  FROM public.brandaro_ai_calls b
  LEFT JOIN public.brandaro_leads_master bl ON bl.id = b.lead_id
  UNION ALL
  SELECT 'bland_call_logs', bc.id::text, bc.created_at, 'call', 'outbound',
         blz.phone_number, bc.call_outcome, COALESCE(bc.source_business,'dynasty'), bc.call_id
  FROM public.bland_call_logs bc
  LEFT JOIN public.bland_leads blz ON blz.id = bc.lead_id
  UNION ALL
  SELECT 'communication_events', ce.id::text, ce.created_at,
         LOWER(COALESCE(ce.channel,'unknown')), LOWER(COALESCE(ce.direction,'unknown')),
         ce.external_contact, ce.event_type, 'gasmask', NULL
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
  src.provider_sid
FROM src;

REVOKE ALL ON public.v_comms_touch_stream FROM anon;
GRANT SELECT ON public.v_comms_touch_stream TO authenticated;
GRANT SELECT ON public.v_comms_touch_stream TO service_role;

INSERT INTO public.public_view_contracts (view_name, allowed_privileges, public_roles, forbidden_columns, notes)
VALUES (
  'v_comms_touch_stream',
  ARRAY['SELECT'],
  ARRAY['authenticated'],
  ARRAY['recording_url','transcript','message_body','full_message','body'],
  'Unified communications touch stream. Read-only, authenticated only (never anon - contains phone numbers). Recording URLs and message bodies are permanently out of contract. Rows with a NULL phone stay visible; never filter them out. New touch sources are added by extending this view, not by creating another log table.'
)
ON CONFLICT (view_name) DO UPDATE
  SET allowed_privileges = EXCLUDED.allowed_privileges,
      public_roles = EXCLUDED.public_roles,
      forbidden_columns = EXCLUDED.forbidden_columns,
      notes = EXCLUDED.notes,
      updated_at = now();