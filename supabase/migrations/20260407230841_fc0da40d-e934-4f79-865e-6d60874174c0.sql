-- Add coach bus fields to tt_bookings
ALTER TABLE public.tt_bookings
  ADD COLUMN IF NOT EXISTS pickup_city TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_city TEXT,
  ADD COLUMN IF NOT EXISTS passenger_count INTEGER,
  ADD COLUMN IF NOT EXISTS special_requests TEXT;

-- Add location fields to tt_partners for geographic matching
ALTER TABLE public.tt_partners
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS service_radius_miles INTEGER DEFAULT 100;

-- Add availability field to tt_broadcast_quotes
ALTER TABLE public.tt_broadcast_quotes
  ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS vehicle_details TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;