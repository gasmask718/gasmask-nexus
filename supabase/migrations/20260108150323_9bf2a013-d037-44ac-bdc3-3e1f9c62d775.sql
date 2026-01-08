-- Add personalization fields to crm_customers
ALTER TABLE public.crm_customers 
ADD COLUMN IF NOT EXISTS favorite_color TEXT,
ADD COLUMN IF NOT EXISTS favorite_song TEXT;