-- Add is_historical flag to invoices table for mode separation
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS is_historical boolean NOT NULL DEFAULT false;

-- Add receipt_sent tracking
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS receipt_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS receipt_message_sid text,
ADD COLUMN IF NOT EXISTS receipt_status text;

-- Add is_historical flag to customer_invoices table as well
ALTER TABLE public.customer_invoices 
ADD COLUMN IF NOT EXISTS is_historical boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS receipt_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS receipt_message_sid text,
ADD COLUMN IF NOT EXISTS receipt_status text;

-- Create receipt log table for full audit trail
CREATE TABLE IF NOT EXISTS public.invoice_receipt_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  customer_invoice_id uuid REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.store_master(id),
  phone_number text NOT NULL,
  message_body text NOT NULL,
  message_sid text,
  delivery_status text DEFAULT 'pending',
  sent_at timestamptz DEFAULT now(),
  delivered_at timestamptz,
  error_message text,
  is_historical_invoice boolean NOT NULL DEFAULT false,
  sent_reason text NOT NULL, -- 'auto_live', 'manual_resend', 'blocked_historical'
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_receipt_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for receipt log
CREATE POLICY "Users can view receipt logs" 
ON public.invoice_receipt_log FOR SELECT USING (true);

CREATE POLICY "Users can insert receipt logs" 
ON public.invoice_receipt_log FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update receipt logs" 
ON public.invoice_receipt_log FOR UPDATE USING (true);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_receipt_log_invoice_id ON public.invoice_receipt_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_receipt_log_store_id ON public.invoice_receipt_log(store_id);
CREATE INDEX IF NOT EXISTS idx_invoices_is_historical ON public.invoices(is_historical);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_is_historical ON public.customer_invoices(is_historical);

-- Comment for documentation
COMMENT ON COLUMN public.invoices.is_historical IS 'When true, this invoice was backfilled/historical entry - NO automation triggers';
COMMENT ON COLUMN public.customer_invoices.is_historical IS 'When true, this invoice was backfilled/historical entry - NO automation triggers';