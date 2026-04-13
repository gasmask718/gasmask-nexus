ALTER TABLE tt_bookings
ADD COLUMN IF NOT EXISTS vehicle_id uuid,
ADD COLUMN IF NOT EXISTS vehicle_name text,
ADD COLUMN IF NOT EXISTS dispatch_method text,
ADD COLUMN IF NOT EXISTS dispatched_to text;