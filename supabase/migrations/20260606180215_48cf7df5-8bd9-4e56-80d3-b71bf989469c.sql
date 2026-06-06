ALTER TABLE public.dd_catalog_drafts
  ADD COLUMN IF NOT EXISTS measurements_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS measurements_verified_by uuid,
  ADD COLUMN IF NOT EXISTS market_check jsonb,
  ADD COLUMN IF NOT EXISTS measurements_estimate jsonb;