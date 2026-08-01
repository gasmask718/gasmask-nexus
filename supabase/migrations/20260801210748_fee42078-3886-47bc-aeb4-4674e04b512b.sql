ALTER TABLE public.brandaro_build_jobs
  ADD COLUMN IF NOT EXISTS intake_data jsonb,
  ADD COLUMN IF NOT EXISTS intake_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intake_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS logo_storage_path text;