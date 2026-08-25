ALTER TABLE public.crm_partners
  ADD COLUMN IF NOT EXISTS geocode_status text,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_crm_partners_geocode_pending
  ON public.crm_partners (geocode_status)
  WHERE geocode_status IS NULL;