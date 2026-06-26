CREATE TABLE IF NOT EXISTS public.daily_ops_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL UNIQUE,
  metrics JSONB NOT NULL,
  email_body TEXT,
  sms_body TEXT,
  sent_to TEXT[],
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.daily_ops_reports TO authenticated;
GRANT ALL ON public.daily_ops_reports TO service_role;

ALTER TABLE public.daily_ops_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view daily ops reports"
ON public.daily_ops_reports FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin','owner')
  )
);

CREATE INDEX IF NOT EXISTS idx_daily_ops_reports_date
  ON public.daily_ops_reports (report_date DESC);

-- Schedule daily 7 AM UTC
SELECT cron.unschedule('daily-ops-report') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-ops-report'
);

SELECT cron.schedule(
  'daily-ops-report',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qalaaroashbggynpvqct.supabase.co/functions/v1/generate-daily-ops-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbGFhcm9hc2hiZ2d5bnB2cWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTI4MjAsImV4cCI6MjA3OTMyODgyMH0.agNLYbG5HnL0tUxalQtxffa5Z11J4gZSh9xzBHVMFMg'
    ),
    body := '{}'::jsonb
  );
  $$
);