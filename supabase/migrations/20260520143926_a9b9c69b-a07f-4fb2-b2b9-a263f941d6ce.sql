
ALTER TABLE public.va_invoices
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_invoice_id text,
  ADD COLUMN IF NOT EXISTS stripe_invoice_url text,
  ADD COLUMN IF NOT EXISTS stripe_invoice_pdf text,
  ADD COLUMN IF NOT EXISTS stripe_invoice_status text,
  ADD COLUMN IF NOT EXISTS stripe_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_sync_error text;

CREATE INDEX IF NOT EXISTS idx_va_invoices_stripe_invoice_id
  ON public.va_invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_va_invoices_stripe_customer_id
  ON public.va_invoices(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
