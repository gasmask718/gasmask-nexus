CREATE TABLE IF NOT EXISTS public.raw_scraper_leads_rejects (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id text NOT NULL,
  county text,
  state text,
  source_url text,
  pdf_hash text,
  row_index integer,
  row_payload jsonb NOT NULL,
  error_message text NOT NULL,
  error_code text,
  rejected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_scraper_leads_rejects_source
  ON public.raw_scraper_leads_rejects (source_id, rejected_at DESC);

GRANT ALL ON public.raw_scraper_leads_rejects TO service_role;

ALTER TABLE public.raw_scraper_leads_rejects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view scraper rejects"
  ON public.raw_scraper_leads_rejects
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));