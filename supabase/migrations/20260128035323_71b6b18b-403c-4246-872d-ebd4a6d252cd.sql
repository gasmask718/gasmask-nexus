-- Master Genius Architect Fix: Add country column to store_master
-- This fixes the "Could not find the 'country' column" error during lead conversion

ALTER TABLE public.store_master
ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'US';

-- Add comment explaining the column
COMMENT ON COLUMN public.store_master.country IS 'ISO 2-letter country code, defaults to US';