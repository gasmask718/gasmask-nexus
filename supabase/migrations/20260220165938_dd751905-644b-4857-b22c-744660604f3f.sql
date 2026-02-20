
-- Add needs_switch signal to store_tube_inventory_status
ALTER TABLE public.store_tube_inventory_status 
  ADD COLUMN IF NOT EXISTS needs_switch boolean NOT NULL DEFAULT false;
