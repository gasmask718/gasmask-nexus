ALTER TABLE public.health_checks DROP CONSTRAINT IF EXISTS health_checks_last_status_check;
ALTER TABLE public.health_checks ADD CONSTRAINT health_checks_last_status_check CHECK (last_status = ANY (ARRAY['pass','warn','fail','unknown','paused']));
ALTER TABLE public.health_check_runs DROP CONSTRAINT IF EXISTS health_check_runs_status_check;
ALTER TABLE public.health_check_runs ADD CONSTRAINT health_check_runs_status_check CHECK (status = ANY (ARRAY['pass','warn','fail','paused']));

CREATE OR REPLACE FUNCTION public.get_cron_job_state(p_jobname text)
RETURNS TABLE(
  jobname text,
  job_active boolean,
  last_start timestamptz,
  last_status text,
  return_message text,
  switch_key text,
  switch_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public','cron'
AS $$
  SELECT j.jobname,
         j.active,
         d.start_time,
         d.status,
         d.return_message,
         s.key,
         s.enabled
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT start_time, status, return_message
    FROM cron.job_run_details
    WHERE jobid = j.jobid
    ORDER BY start_time DESC
    LIMIT 1
  ) d ON true
  LEFT JOIN public.outreach_switches s ON s.cron_jobid = j.jobid
  WHERE j.jobname = p_jobname
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_cron_job_state(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cron_job_state(text) TO authenticated, service_role;