
-- Phase 1: Add price_per_box_snapshot and price_per_tube_snapshot to invoice_line_items
ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS price_per_box_snapshot numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_per_tube_snapshot numeric DEFAULT NULL;

-- Phase 2: Backfill products.price_per_tube where it's null but price_per_box and units_per_box exist
UPDATE public.products
SET price_per_tube = ROUND(price_per_box / NULLIF(units_per_box, 0), 2)
WHERE price_per_tube IS NULL
  AND price_per_box IS NOT NULL
  AND units_per_box IS NOT NULL
  AND units_per_box > 0;
