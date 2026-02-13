
-- Add recipient/delivery fields to store_orders for assignment workflow
ALTER TABLE public.store_orders 
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_lat numeric,
  ADD COLUMN IF NOT EXISTS delivery_lng numeric;

-- Add driver_id column to delivery_tasks so we can assign either biker or driver
ALTER TABLE public.delivery_tasks
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.drivers(id),
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_phone text;
