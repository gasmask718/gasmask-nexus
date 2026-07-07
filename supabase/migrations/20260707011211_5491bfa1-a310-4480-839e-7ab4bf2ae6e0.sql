ALTER TABLE public.funding_clients
  ADD COLUMN IF NOT EXISTS ai_last_analysis text,
  ADD COLUMN IF NOT EXISTS ai_analysis_date timestamptz;