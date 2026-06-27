CREATE OR REPLACE VIEW public.cron_status
WITH (security_invoker = true)
AS
SELECT
  j.jobid,
  j.jobname,
  j.schedule,
  j.command,
  j.active,
  (
    SELECT row_to_json(last_run)
    FROM (
      SELECT start_time, end_time, status, return_message
      FROM cron.job_run_details
      WHERE jobid = j.jobid
      ORDER BY start_time DESC
      LIMIT 1
    ) last_run
  ) AS last_run
FROM cron.job j;

GRANT SELECT ON public.cron_status TO authenticated;
GRANT SELECT ON public.cron_status TO service_role;