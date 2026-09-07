ALTER TABLE public.business_leads DROP CONSTRAINT business_leads_business_known;

ALTER TABLE public.business_leads ADD CONSTRAINT business_leads_business_known
  CHECK (business = ANY (ARRAY['ut'::text,'toptier'::text,'dynasty'::text,'brandaro'::text,'gasmask'::text,'surplus'::text,'brightsun'::text,'playboxxx'::text]));

CREATE UNIQUE INDEX IF NOT EXISTS business_leads_ext_ref_unique
  ON public.business_leads (business, external_source, external_place_id)
  WHERE duplicate_of IS NULL AND external_source IS NOT NULL AND external_place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS business_leads_business_category_created_idx
  ON public.business_leads (business, category, created_at DESC);