ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS business_date_source text,
  ADD COLUMN IF NOT EXISTS business_date_source_note text;

CREATE TABLE public.invoice_business_date_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  store_id uuid,
  lane text NOT NULL,
  raw_note text NOT NULL,
  prior_business_date date,
  parsed_business_date date,
  parse_outcome text NOT NULL,
  applied boolean NOT NULL DEFAULT false,
  reverted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ibds_run ON public.invoice_business_date_staging(run_id);
CREATE INDEX idx_ibds_invoice ON public.invoice_business_date_staging(invoice_id);
CREATE INDEX idx_ibds_outcome ON public.invoice_business_date_staging(parse_outcome);

GRANT SELECT ON public.invoice_business_date_staging TO authenticated;
GRANT ALL ON public.invoice_business_date_staging TO service_role;
ALTER TABLE public.invoice_business_date_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ibds_admin_only" ON public.invoice_business_date_staging
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.invoice_duplicate_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  lane text NOT NULL,
  store_id uuid,
  business_date date,
  invoice_id_a uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  invoice_id_b uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount_a numeric,
  amount_b numeric,
  amount_at_risk numeric,
  match_reason text NOT NULL,
  confidence text NOT NULL DEFAULT 'medium',
  review_status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_idc_run ON public.invoice_duplicate_candidates(run_id);
CREATE INDEX idx_idc_status ON public.invoice_duplicate_candidates(review_status);
CREATE INDEX idx_idc_store ON public.invoice_duplicate_candidates(store_id);

GRANT SELECT, UPDATE ON public.invoice_duplicate_candidates TO authenticated;
GRANT ALL ON public.invoice_duplicate_candidates TO service_role;
ALTER TABLE public.invoice_duplicate_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "idc_admin_read" ON public.invoice_duplicate_candidates
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "idc_admin_update" ON public.invoice_duplicate_candidates
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));