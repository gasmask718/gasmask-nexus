ALTER TABLE public.store_tube_inventory_status
  ADD COLUMN IF NOT EXISTS is_active boolean;

COMMENT ON COLUMN public.store_tube_inventory_status.is_active IS
  'Per-product (SKU) activation for Tube Intelligence. NULL = inherit the brand-level store_brand_relationships.is_active. Scoped by (store_id, brand_id, is_simulation).';