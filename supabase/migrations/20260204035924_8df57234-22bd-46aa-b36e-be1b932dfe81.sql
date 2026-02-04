-- Add street_price column to products table (safe migration)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS street_price NUMERIC(10,2);

COMMENT ON COLUMN public.products.street_price
IS 'Optional street-level selling price. Internal use only.';

-- Optional backfill: set street_price = retail_price where null
UPDATE public.products
SET street_price = suggested_retail_price
WHERE street_price IS NULL AND suggested_retail_price IS NOT NULL;

-- Force schema cache refresh
NOTIFY pgrst, 'reload schema';