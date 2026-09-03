CREATE TABLE public.icw_candidate_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text,
  phone text,
  email text,
  city text,
  state text,
  region text,
  country text NOT NULL DEFAULT 'US',
  service_area text,
  category_groups text[],
  source_platform text,
  source_url text,
  source_id text,
  experience_summary text,
  availability_summary text,
  notes text,
  status text NOT NULL DEFAULT 'candidate',
  ingestion_run_id text,
  converted_worker_id uuid REFERENCES public.icw_workers(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.icw_candidate_leads TO authenticated;
GRANT ALL ON public.icw_candidate_leads TO service_role;

ALTER TABLE public.icw_candidate_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access icw_candidate_leads"
  ON public.icw_candidate_leads FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Staff can manage ICW candidate leads"
  ON public.icw_candidate_leads FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX idx_icw_candidate_leads_source ON public.icw_candidate_leads (source_platform, source_id);
CREATE INDEX idx_icw_candidate_leads_phone ON public.icw_candidate_leads (phone);
CREATE INDEX idx_icw_candidate_leads_status ON public.icw_candidate_leads (status);

CREATE TRIGGER update_icw_candidate_leads_updated_at
  BEFORE UPDATE ON public.icw_candidate_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();