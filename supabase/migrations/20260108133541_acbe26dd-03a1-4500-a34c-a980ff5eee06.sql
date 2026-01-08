-- Add partial_amount column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS partial_amount NUMERIC DEFAULT NULL;