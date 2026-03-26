
-- Add Google Places columns to ut_partner_leads
ALTER TABLE public.ut_partner_leads
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_place_id text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS full_address text,
  ADD COLUMN IF NOT EXISTS google_rating numeric(2,1),
  ADD COLUMN IF NOT EXISTS google_types text[],
  ADD COLUMN IF NOT EXISTS maps_url text;

-- Index for duplicate detection by place_id
CREATE INDEX IF NOT EXISTS idx_ut_partner_leads_place_id ON public.ut_partner_leads(external_place_id) WHERE external_place_id IS NOT NULL;
