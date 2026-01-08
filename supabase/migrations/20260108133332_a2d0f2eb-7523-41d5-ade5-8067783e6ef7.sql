-- Add delivery_photos column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS delivery_photos TEXT[] DEFAULT NULL;