ALTER TABLE public.icw_sourced_leads
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS region text;

COMMENT ON COLUMN public.icw_sourced_leads.country IS 'ISO-ish country label for the lead. Defaults to US for legacy rows.';
COMMENT ON COLUMN public.icw_sourced_leads.region IS 'Province/region/administrative area for non-US leads. US leads continue to use the 2-letter state column.';