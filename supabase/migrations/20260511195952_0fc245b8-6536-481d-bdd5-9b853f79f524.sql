
-- Rebuild view to include dial-count metrics (today + total) per Twilio number.
-- Counts come from va_call_logs where twilio_number matches phone_number.
DROP VIEW IF EXISTS public.brandaro_number_last_sessions;

CREATE VIEW public.brandaro_number_last_sessions
WITH (security_invoker = false) AS
WITH last_session AS (
  SELECT DISTINCT ON (n.id)
    n.id AS number_id,
    s.id AS session_id,
    s.va_id,
    s.started_at,
    s.ended_at,
    s.is_active
  FROM public.dc_phone_numbers n
  LEFT JOIN public.va_sessions s ON s.twilio_number_id = n.id
  ORDER BY n.id, s.started_at DESC NULLS LAST
),
dial_counts AS (
  SELECT
    twilio_number,
    COUNT(*) FILTER (WHERE called_at >= date_trunc('day', now() AT TIME ZONE 'UTC')) AS today_dials,
    COUNT(*) AS total_dials,
    MAX(called_at) AS last_dialed_at
  FROM public.va_call_logs
  WHERE twilio_number IS NOT NULL
  GROUP BY twilio_number
)
SELECT
  n.id AS number_id,
  n.phone_number,
  n.friendly_name,
  n.business,
  (COALESCE(ls.is_active, false) AND ls.ended_at IS NULL) AS in_use,
  ls.va_id AS assigned_va_id,
  ls.session_id,
  ls.va_id AS last_va_id,
  ls.started_at,
  ls.ended_at,
  COALESCE(ls.is_active, false) AS session_active,
  COALESCE(dc.today_dials, 0)::int AS today_dials,
  COALESCE(dc.total_dials, 0)::int AS total_dials,
  dc.last_dialed_at
FROM public.dc_phone_numbers n
LEFT JOIN last_session ls ON ls.number_id = n.id
LEFT JOIN dial_counts dc ON dc.twilio_number = n.phone_number
WHERE n.is_active = true
  AND n.number_type = 'local'
  AND COALESCE(n.friendly_name, '') !~~* '%AI Agent%';

GRANT SELECT ON public.brandaro_number_last_sessions TO authenticated, anon;
