-- Add street_price column for personal/street customer pricing channel
ALTER TABLE public.products_all 
ADD COLUMN IF NOT EXISTS street_price numeric DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.products_all.street_price IS 'Street/personal customer price - typically higher than retail for direct sales';