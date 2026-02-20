
-- Add switch quantity intelligence columns to store_tube_inventory_status
ALTER TABLE public.store_tube_inventory_status
  ADD COLUMN IF NOT EXISTS switch_quantity integer,
  ADD COLUMN IF NOT EXISTS switch_notes text,
  ADD COLUMN IF NOT EXISTS switch_flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS switch_flagged_by uuid;
