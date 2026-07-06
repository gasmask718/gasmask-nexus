
ALTER TABLE public.re_leads
  ADD COLUMN IF NOT EXISTS realestateapi_property_id text,
  ADD COLUMN IF NOT EXISTS first_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS bland_campaign_id text,
  ADD COLUMN IF NOT EXISTS lead_score integer,
  ADD COLUMN IF NOT EXISTS dnc boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb,
  ADD COLUMN IF NOT EXISTS imported_batch_id uuid,
  ADD COLUMN IF NOT EXISTS mailing_address text,
  ADD COLUMN IF NOT EXISTS mailing_city text,
  ADD COLUMN IF NOT EXISTS mailing_state text,
  ADD COLUMN IF NOT EXISTS mailing_zip text,
  ADD COLUMN IF NOT EXISTS phones_all text[],
  ADD COLUMN IF NOT EXISTS emails_all text[];

ALTER TABLE public.re_leads
  DROP CONSTRAINT IF EXISTS re_leads_lead_score_range;
ALTER TABLE public.re_leads
  ADD CONSTRAINT re_leads_lead_score_range CHECK (lead_score IS NULL OR (lead_score BETWEEN 0 AND 100));

CREATE UNIQUE INDEX IF NOT EXISTS re_leads_realestateapi_property_id_uniq
  ON public.re_leads (realestateapi_property_id)
  WHERE realestateapi_property_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS re_leads_address_zip_uniq
  ON public.re_leads (lower(property_address), zip)
  WHERE realestateapi_property_id IS NULL;

CREATE INDEX IF NOT EXISTS re_leads_imported_batch_id_idx
  ON public.re_leads (imported_batch_id);

CREATE INDEX IF NOT EXISTS re_leads_lead_source_status_idx
  ON public.re_leads (lead_source, status);
