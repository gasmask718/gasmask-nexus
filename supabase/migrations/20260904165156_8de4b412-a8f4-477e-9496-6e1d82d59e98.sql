ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_promo_sample boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promo_sample_available_qty integer,
  ADD COLUMN IF NOT EXISTS promo_sample_qty_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS promo_sample_qty_updated_by uuid;

ALTER TABLE public.store_tube_inventory_status
  ADD COLUMN IF NOT EXISTS sample_qty_to_bring integer;

-- GasMask's single promotional sample item (GasMask Tubes SKU).
UPDATE public.products
   SET is_promo_sample = true
 WHERE id = 'dd5e14c0-d6c5-403a-a2d7-504181b0f4ea';