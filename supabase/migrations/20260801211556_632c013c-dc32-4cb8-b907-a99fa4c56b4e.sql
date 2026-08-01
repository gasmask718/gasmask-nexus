ALTER TABLE public.brandaro_build_jobs
  ADD COLUMN IF NOT EXISTS vercel_project_id text,
  ADD COLUMN IF NOT EXISTS vercel_deployment_id text,
  ADD COLUMN IF NOT EXISTS preview_url text,
  ADD COLUMN IF NOT EXISTS review_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_brandaro_build_jobs_vercel_project
  ON public.brandaro_build_jobs (vercel_project_id);