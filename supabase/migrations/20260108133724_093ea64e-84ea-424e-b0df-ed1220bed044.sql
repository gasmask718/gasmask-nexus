-- Add received_by column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS received_by TEXT DEFAULT NULL;