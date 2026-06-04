
CREATE OR REPLACE FUNCTION public.get_last_cron_run(p_jobname text)
RETURNS TABLE (jobname text, last_start timestamptz, last_status text, return_message text)
LANGUAGE sql SECURITY DEFINER SET search_path = public, cron AS $$
  SELECT j.jobname, d.start_time, d.status, d.return_message
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT start_time, status, return_message
    FROM cron.job_run_details
    WHERE jobid = j.jobid
    ORDER BY start_time DESC
    LIMIT 1
  ) d ON true
  WHERE j.jobname = p_jobname;
$$;

GRANT EXECUTE ON FUNCTION public.get_last_cron_run(text) TO authenticated, service_role;
