-- Stage 2: one shared read-only sales activity rollup.
-- Reuses existing sources only: va_call_logs, communication_logs, va_sessions.

CREATE OR REPLACE VIEW public.v_sales_activity
WITH (security_invoker = true) AS
WITH va AS (
  SELECT
    'va_call_logs'::text                              AS source_table,
    v.id                                              AS source_id,
    v.called_at                                       AS occurred_at,
    'call'::text                                      AS channel,
    COALESCE(v.direction, 'outbound')                 AS direction,
    v.va_id                                           AS agent_id,
    v.store_id,
    v.contact_id,
    v.call_status                                     AS status,
    v.disposition                                     AS outcome,
    COALESCE(v.duration_seconds, 0)                   AS duration_seconds,
    v.follow_up_at,
    v.wrap_up_completed_at                            AS completed_at,
    v.to_number                                       AS phone,
    v.call_summary                                    AS summary,
    v.call_sid                                        AS provider_sid,
    NULL::uuid                                        AS business_id,
    false                                             AS is_automated
  FROM public.va_call_logs v
),
comm AS (
  SELECT
    'communication_logs'::text                        AS source_table,
    c.id                                              AS source_id,
    COALESCE(c.created_at, c.sent_at, c.started_at)   AS occurred_at,
    CASE WHEN c.channel = 'sms' THEN 'sms' ELSE 'call' END AS channel,
    COALESCE(c.direction, 'outbound')                 AS direction,
    c.created_by                                      AS agent_id,
    c.store_id,
    c.contact_id,
    COALESCE(c.status, c.delivery_status)             AS status,
    c.outcome,
    COALESCE(c.duration_seconds, c.call_duration, 0)  AS duration_seconds,
    c.follow_up_date                                  AS follow_up_at,
    NULL::timestamptz                                 AS completed_at,
    COALESCE(c.recipient_phone, c.sender_phone)       AS phone,
    COALESCE(c.summary, c.message_content)            AS summary,
    COALESCE(c.twilio_call_sid, c.twilio_sid)         AS provider_sid,
    c.business_id,
    (COALESCE(c.ai_assisted, false)
       OR COALESCE(c.bland_ai_handled, false)
       OR lower(COALESCE(c.performed_by, '')) IN ('system', 'ai', 'automation')) AS is_automated
  FROM public.communication_logs c
  WHERE c.channel IN ('sms', 'call', 'voice', 'phone')
    -- the same Twilio call can be mirrored into both tables: va_call_logs wins
    AND NOT EXISTS (
      SELECT 1 FROM public.va_call_logs v
      WHERE v.call_sid IS NOT NULL
        AND v.call_sid = COALESCE(c.twilio_call_sid, c.twilio_sid)
    )
),
unioned AS (
  SELECT * FROM va
  UNION ALL
  SELECT * FROM comm
)
SELECT
  u.source_table || ':' || u.source_id::text AS activity_id,
  u.source_table,
  u.source_id,
  u.occurred_at,
  u.channel,
  u.direction,
  u.agent_id,
  u.store_id,
  u.contact_id,
  u.status,
  u.outcome,
  u.duration_seconds,
  u.follow_up_at,
  u.completed_at,
  u.phone,
  u.summary,
  u.provider_sid,
  u.business_id,
  CASE
    WHEN u.agent_id IS NOT NULL              THEN 'agent'
    WHEN u.is_automated                      THEN 'automated'
    WHEN lower(u.direction) = 'inbound'      THEN 'inbound_unattributed'
    ELSE 'system_unattributed'
  END AS attribution,
  (lower(COALESCE(u.status, '')) IN ('completed', 'answered', 'in-progress', 'delivered', 'sent')
    OR u.duration_seconds > 0) AS is_connected
FROM unioned u
WHERE u.occurred_at IS NOT NULL;

COMMENT ON VIEW public.v_sales_activity IS
  'Stage 2 shared sales activity feed. Read-only union of va_call_logs and communication_logs (calls + sms). Attribution is never guessed: rows without a real user id are labelled automated / inbound_unattributed / system_unattributed.';

CREATE OR REPLACE VIEW public.v_sales_agent_rollup
WITH (security_invoker = true) AS
SELECT
  a.agent_id,
  a.attribution,
  count(*) FILTER (WHERE a.channel = 'call')                                     AS calls_total,
  count(*) FILTER (WHERE a.channel = 'call' AND lower(a.direction) = 'outbound') AS calls_placed,
  count(*) FILTER (WHERE a.channel = 'call' AND a.is_connected)                  AS calls_connected,
  COALESCE(sum(a.duration_seconds) FILTER (WHERE a.channel = 'call'), 0)         AS talk_time_seconds,
  count(*) FILTER (WHERE a.channel = 'sms' AND lower(a.direction) = 'outbound')  AS texts_sent,
  count(*) FILTER (WHERE a.channel = 'sms' AND lower(a.direction) = 'inbound')   AS texts_received,
  count(DISTINCT a.store_id)                                                     AS accounts_touched,
  count(DISTINCT a.store_id) FILTER (WHERE a.completed_at IS NOT NULL)           AS accounts_completed,
  count(DISTINCT a.contact_id)                                                   AS contacts_touched,
  count(*) FILTER (WHERE a.follow_up_at IS NOT NULL)                             AS follow_ups_created,
  count(DISTINCT a.outcome) FILTER (WHERE a.outcome IS NOT NULL)                 AS distinct_outcomes,
  min(a.occurred_at)                                                             AS first_activity_at,
  max(a.occurred_at)                                                             AS latest_activity_at
FROM public.v_sales_activity a
GROUP BY a.agent_id, a.attribution;

COMMENT ON VIEW public.v_sales_agent_rollup IS
  'Stage 2 per-agent rollup over v_sales_activity. Unattributed/automated traffic is kept in its own attribution buckets, never credited to a person. No revenue, commission, team or manager data.';

GRANT SELECT ON public.v_sales_activity TO authenticated;
GRANT SELECT ON public.v_sales_agent_rollup TO authenticated;
GRANT ALL ON public.v_sales_activity TO service_role;
GRANT ALL ON public.v_sales_agent_rollup TO service_role;