-- Add street_price to the products table (parallel to products_all)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS street_price NUMERIC(10,2) DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.products.street_price IS 'Street/personal customer price - typically higher margin than retail';