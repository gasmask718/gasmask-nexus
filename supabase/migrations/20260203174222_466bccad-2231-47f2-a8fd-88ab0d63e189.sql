-- Add role tracking to store_tube_inventory_status for attribution
ALTER TABLE public.store_tube_inventory_status 
ADD COLUMN IF NOT EXISTS last_updated_by_role TEXT;

-- Add index for common filter queries
CREATE INDEX IF NOT EXISTS idx_tube_intel_needs_order 
ON public.store_tube_inventory_status(needs_order) WHERE needs_order = true;

CREATE INDEX IF NOT EXISTS idx_tube_intel_bring_samples 
ON public.store_tube_inventory_status(bring_samples) WHERE bring_samples = true;

CREATE INDEX IF NOT EXISTS idx_tube_intel_bring_starter_kit 
ON public.store_tube_inventory_status(bring_starter_kit) WHERE bring_starter_kit = true;

CREATE INDEX IF NOT EXISTS idx_tube_intel_not_introduced 
ON public.store_tube_inventory_status(product_introduced) WHERE product_introduced = false;

COMMENT ON COLUMN public.store_tube_inventory_status.last_updated_by_role IS 'Role of user who last updated: admin, va, ambassador, biker, driver';