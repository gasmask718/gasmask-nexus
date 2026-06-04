ALTER TABLE public.store_applications
  ADD COLUMN IF NOT EXISTS triage_score integer,
  ADD COLUMN IF NOT EXISTS triage_summary text,
  ADD COLUMN IF NOT EXISTS triage_signals jsonb,
  ADD COLUMN IF NOT EXISTS triage_model text,
  ADD COLUMN IF NOT EXISTS triaged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_store_applications_triage
  ON public.store_applications (status, triage_score DESC NULLS LAST, created_at DESC);

COMMENT ON COLUMN public.store_applications.triage_score IS
  'AI-derived 0-100 legitimacy signal; informs sort order, never auto-decides.';