-- 1. Heartbeat column
ALTER TABLE public.va_sessions
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

UPDATE public.va_sessions
   SET last_seen_at = COALESCE(last_seen_at, ended_at, started_at)
 WHERE last_seen_at IS NULL;

-- 2. Auto-close stale active sessions (>15 min without heartbeat)
UPDATE public.va_sessions
   SET is_active = false,
       ended_at  = COALESCE(ended_at, GREATEST(last_seen_at, started_at) + interval '15 minutes')
 WHERE is_active = true
   AND ended_at IS NULL
   AND COALESCE(last_seen_at, started_at) < now() - interval '15 minutes';

-- 3. Replace view: session_active requires fresh heartbeat
DROP VIEW IF EXISTS public.brandaro_number_last_sessions;
CREATE VIEW public.brandaro_number_last_sessions AS
WITH last_session AS (
  SELECT DISTINCT ON (n_1.id)
         n_1.id              AS number_id,
         s.id                AS session_id,
         s.va_id,
         s.started_at,
         s.ended_at,
         s.is_active,
         s.last_seen_at
    FROM public.dc_phone_numbers n_1
    LEFT JOIN public.va_sessions s ON s.twilio_number_id = n_1.id
   ORDER BY n_1.id, s.started_at DESC NULLS LAST
), dial_counts AS (
  SELECT va_call_logs.twilio_number,
         count(*) FILTER (WHERE va_call_logs.called_at >= date_trunc('day', (now() AT TIME ZONE 'UTC'))) AS today_dials,
         count(*) AS total_dials,
         max(va_call_logs.called_at) AS last_dialed_at
    FROM public.va_call_logs
   WHERE va_call_logs.twilio_number IS NOT NULL
   GROUP BY va_call_logs.twilio_number
)
SELECT n.id AS number_id,
       n.phone_number,
       n.friendly_name,
       n.business,
       (COALESCE(ls.is_active, false)
         AND ls.ended_at IS NULL
         AND COALESCE(ls.last_seen_at, ls.started_at) > now() - interval '15 minutes') AS in_use,
       ls.va_id AS assigned_va_id,
       ls.session_id,
       ls.va_id AS last_va_id,
       ls.started_at,
       ls.ended_at,
       (COALESCE(ls.is_active, false)
         AND ls.ended_at IS NULL
         AND COALESCE(ls.last_seen_at, ls.started_at) > now() - interval '15 minutes') AS session_active,
       COALESCE(dc.today_dials, 0::bigint)::integer AS today_dials,
       COALESCE(dc.total_dials, 0::bigint)::integer AS total_dials,
       dc.last_dialed_at
  FROM public.dc_phone_numbers n
  LEFT JOIN last_session ls ON ls.number_id = n.id
  LEFT JOIN dial_counts dc ON dc.twilio_number = n.phone_number
 WHERE n.is_active = true
   AND n.number_type = 'local'
   AND COALESCE(n.friendly_name, '') !~~* '%AI Agent%';

-- 4. Force-release RPC: any authenticated user can free a stuck number
CREATE OR REPLACE FUNCTION public.force_release_va_number(p_number_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.va_sessions
     SET is_active = false,
         ended_at  = COALESCE(ended_at, now())
   WHERE twilio_number_id = p_number_id
     AND is_active = true;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_release_va_number(uuid) TO authenticated;
