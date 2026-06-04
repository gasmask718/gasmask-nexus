
CREATE OR REPLACE VIEW public.cron_job_health_overview AS
SELECT
  j.jobid,
  j.jobname,
  j.schedule,
  j.active,
  j.command,
  lr.last_start,
  lr.last_status                 AS cron_last_status,
  lr.last_runtime_ms,
  hc.id                          AS health_check_id,
  hc.cadence_expected_minutes,
  hc.last_run_at                 AS health_last_run_at,
  hc.last_ok_at                  AS health_last_ok_at,
  hc.last_status                 AS health_last_status,
  hc.last_message                AS health_last_message
FROM cron.job j
LEFT JOIN LATERAL (
  SELECT
    d.start_time                                              AS last_start,
    d.status                                                  AS last_status,
    EXTRACT(EPOCH FROM (d.end_time - d.start_time)) * 1000    AS last_runtime_ms
  FROM cron.job_run_details d
  WHERE d.jobid = j.jobid
  ORDER BY d.start_time DESC
  LIMIT 1
) lr ON true
LEFT JOIN public.health_checks hc ON hc.check_key = j.jobname;

REVOKE ALL ON public.cron_job_health_overview FROM PUBLIC;
GRANT SELECT ON public.cron_job_health_overview TO authenticated;
GRANT SELECT ON public.cron_job_health_overview TO service_role;

COMMENT ON VIEW public.cron_job_health_overview IS
  'T3 M3: unified view of cron.job + latest cron.job_run_details + health_checks. Read-only.';
