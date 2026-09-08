ALTER TYPE public.icw_job_status ADD VALUE IF NOT EXISTS 'awaiting_worker_response' AFTER 'pending';

ALTER TABLE public.icw_jobs
  ADD COLUMN IF NOT EXISTS declined_worker_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS awaiting_response_since timestamptz;

ALTER TABLE public.icw_workers
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_icw_workers_user_id
  ON public.icw_workers (user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_icw_jobs_awaiting
  ON public.icw_jobs (status, awaiting_response_since)
  WHERE awaiting_response_since IS NOT NULL;