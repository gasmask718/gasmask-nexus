CREATE TABLE IF NOT EXISTS public.invoice_amount_writeback_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  store_id uuid,
  tier text NOT NULL,
  previous_total_amount numeric,
  previous_total numeric,
  previous_subtotal numeric,
  new_total_amount numeric NOT NULL,
  source_note text,
  applied_at timestamptz,
  reverted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.invoice_amount_writeback_staging TO authenticated;
GRANT ALL ON public.invoice_amount_writeback_staging TO service_role;

ALTER TABLE public.invoice_amount_writeback_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read invoice amount writeback staging"
ON public.invoice_amount_writeback_staging FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_iaws_run ON public.invoice_amount_writeback_staging(run_id);
CREATE INDEX IF NOT EXISTS idx_iaws_invoice ON public.invoice_amount_writeback_staging(invoice_id);