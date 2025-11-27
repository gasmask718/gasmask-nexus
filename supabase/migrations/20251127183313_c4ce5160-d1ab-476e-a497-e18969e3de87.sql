
-- Make store_id nullable in invoices to support all company types
ALTER TABLE public.invoices ALTER COLUMN store_id DROP NOT NULL;
