CREATE TABLE public.icw_ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text,
  geography text,
  source text,
  query_term text,
  started_at timestamptz,
  completed_at timestamptz,
  outcome text,
  raw_result_count integer NOT NULL DEFAULT 0,
  new_lead_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.icw_ingestion_runs TO authenticated;
GRANT ALL ON public.icw_ingestion_runs TO service_role;
ALTER TABLE public.icw_ingestion_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage ICW ingestion runs" ON public.icw_ingestion_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access icw_ingestion_runs" ON public.icw_ingestion_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.icw_sourced_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  phone text,
  email text,
  website_social text,
  address text,
  city text,
  state text,
  postal_code text,
  latitude numeric,
  longitude numeric,
  category_groups text[] NOT NULL DEFAULT '{}',
  source_platform text,
  source_url text,
  source_id text,
  license_number text,
  license_type text,
  license_status text,
  status text NOT NULL DEFAULT 'prospect',
  promoted_worker_id uuid REFERENCES public.icw_workers(id) ON DELETE SET NULL,
  ingestion_run_id uuid REFERENCES public.icw_ingestion_runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.icw_sourced_leads TO authenticated;
GRANT ALL ON public.icw_sourced_leads TO service_role;
ALTER TABLE public.icw_sourced_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage ICW sourced leads" ON public.icw_sourced_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access icw_sourced_leads" ON public.icw_sourced_leads FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_icw_sourced_leads_phone ON public.icw_sourced_leads (phone);
CREATE INDEX idx_icw_sourced_leads_license ON public.icw_sourced_leads (license_number);
CREATE INDEX idx_icw_sourced_leads_source ON public.icw_sourced_leads (source_platform, source_id);
CREATE INDEX idx_icw_sourced_leads_status ON public.icw_sourced_leads (status);
CREATE INDEX idx_icw_sourced_leads_geo ON public.icw_sourced_leads (latitude, longitude);
CREATE INDEX idx_icw_sourced_leads_run ON public.icw_sourced_leads (ingestion_run_id);

CREATE TRIGGER trg_icw_sourced_leads_updated_at
BEFORE UPDATE ON public.icw_sourced_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();