-- Add missing receipt tracking columns to customer_invoices
ALTER TABLE public.customer_invoices 
ADD COLUMN IF NOT EXISTS receipt_delivered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS receipt_failure_reason TEXT,
ADD COLUMN IF NOT EXISTS receipt_phone_used TEXT;

-- Backfill existing invoices with default status
UPDATE public.customer_invoices 
SET receipt_status = 'not_sent' 
WHERE receipt_status IS NULL;