
-- Provenance on invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_status_source text NOT NULL DEFAULT 'recorded',
  ADD COLUMN IF NOT EXISTS payment_status_source_note text;

COMMENT ON COLUMN public.invoices.payment_status_source IS
  'recorded = from an actual payment event; note_parse = inferred from invoices.notes text by the phantom-AR parser. Never treat note_parse as a payment record.';

-- Staging / audit table for the correction run
CREATE TABLE public.ar_phantom_paid_staging (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  store_id uuid,
  raw_note text NOT NULL,
  prior_payment_status text,
  prior_amount_paid numeric,
  prior_paid_at timestamptz,
  prior_business_date date,
  parsed_paid_at timestamptz,
  parsed_date_confidence text NOT NULL,
  parsed_qty integer,
  parsed_unit text,
  parsed_amount numeric,
  total_amount numeric,
  dollar_figure_count integer,
  applied boolean NOT NULL DEFAULT false,
  reverted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ar_phantom_run ON public.ar_phantom_paid_staging(run_id);
CREATE INDEX idx_ar_phantom_invoice ON public.ar_phantom_paid_staging(invoice_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ar_phantom_paid_staging TO authenticated;
GRANT ALL ON public.ar_phantom_paid_staging TO service_role;

ALTER TABLE public.ar_phantom_paid_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ar_phantom_staging_admin_only"
ON public.ar_phantom_paid_staging
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));
