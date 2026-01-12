-- Add base_unit column to product_conversions table
-- This allows each product to define its own base unit (TUBE, BAG, WRAP, PIECE, etc.)
ALTER TABLE public.product_conversions
ADD COLUMN base_unit text NOT NULL DEFAULT 'TUBE';

-- Add a comment to explain the column
COMMENT ON COLUMN public.product_conversions.base_unit IS 'The base unit for this product (TUBE, BAG, WRAP, PIECE, or custom). Once set, should not be changed to preserve historical accuracy.';

-- Rename tubes_per_unit to base_units_per_unit for clarity
ALTER TABLE public.product_conversions
RENAME COLUMN tubes_per_unit TO base_units_per_unit;

-- Add comment for the renamed column
COMMENT ON COLUMN public.product_conversions.base_units_per_unit IS 'How many base units equal one of the specified unit_type';