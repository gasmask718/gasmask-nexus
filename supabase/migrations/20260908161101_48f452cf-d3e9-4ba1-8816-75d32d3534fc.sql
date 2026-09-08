ALTER TABLE public.icw_jobs
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS customer_email text;

CREATE UNIQUE INDEX IF NOT EXISTS icw_jobs_external_booking_id_key
  ON public.icw_jobs (external_booking_id);

CREATE INDEX IF NOT EXISTS icw_dispatch_log_job_event_idx
  ON public.icw_dispatch_log (job_id, event, created_at DESC);