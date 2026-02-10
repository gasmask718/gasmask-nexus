
-- Add payment/invoice detail columns to store_master
ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS invoice_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_payment_status text DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS invoice_payment_method text,
  ADD COLUMN IF NOT EXISTS invoice_amount_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_due_date date,
  ADD COLUMN IF NOT EXISTS invoice_date date,
  ADD COLUMN IF NOT EXISTS invoice_brand text,
  ADD COLUMN IF NOT EXISTS invoice_notes text,
  ADD COLUMN IF NOT EXISTS invoice_paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS invoice_received_by text;
