DROP VIEW IF EXISTS public.brandaro_number_last_sessions;

CREATE VIEW public.brandaro_number_last_sessions
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (n.id)
  n.id            AS number_id,
  n.phone_number,
  n.friendly_name,
  n.business,
  COALESCE(s.is_active, false) AND s.ended_at IS NULL AS in_use,
  s.va_id         AS assigned_va_id,
  s.id            AS session_id,
  s.va_id         AS last_va_id,
  s.started_at,
  s.ended_at,
  COALESCE(s.is_active, false) AS session_active
FROM public.dc_phone_numbers n
LEFT JOIN public.va_sessions s
  ON s.twilio_number_id = n.id
WHERE n.is_active = true
  AND n.number_type = 'local'
  AND COALESCE(n.friendly_name, '') NOT ILIKE '%AI Agent%'
ORDER BY n.id, s.started_at DESC NULLS LAST;

GRANT SELECT ON public.brandaro_number_last_sessions TO authenticated;