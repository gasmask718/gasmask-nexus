ALTER TABLE public.brandaro_build_jobs
  ADD COLUMN IF NOT EXISTS durable_site_id text,
  ADD COLUMN IF NOT EXISTS durable_generated_url text,
  ADD COLUMN IF NOT EXISTS durable_job_status text,
  ADD COLUMN IF NOT EXISTS durable_last_error text;
CREATE INDEX IF NOT EXISTS idx_brandaro_build_jobs_durable_site_id
  ON public.brandaro_build_jobs (durable_site_id);