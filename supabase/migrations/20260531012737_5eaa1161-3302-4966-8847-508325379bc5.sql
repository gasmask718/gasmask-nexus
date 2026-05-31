
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dc-configure-webhooks-bulk-daily') THEN
    PERFORM cron.unschedule('dc-configure-webhooks-bulk-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'dc-configure-webhooks-bulk-daily',
  '0 9 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://qalaaroashbggynpvqct.supabase.co/functions/v1/dc-configure-webhooks-bulk?triggered_by=cron',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbGFhcm9hc2hiZ2d5bnB2cWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTI4MjAsImV4cCI6MjA3OTMyODgyMH0.agNLYbG5HnL0tUxalQtxffa5Z11J4gZSh9xzBHVMFMg","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbGFhcm9hc2hiZ2d5bnB2cWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTI4MjAsImV4cCI6MjA3OTMyODgyMH0.agNLYbG5HnL0tUxalQtxffa5Z11J4gZSh9xzBHVMFMg"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);
