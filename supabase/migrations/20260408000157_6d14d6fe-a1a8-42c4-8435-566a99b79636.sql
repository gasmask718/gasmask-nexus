
ALTER TABLE public.cb_booking_requests
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'coach_bus',
  ADD COLUMN IF NOT EXISTS aircraft_preference TEXT,
  ADD COLUMN IF NOT EXISTS departure_airport TEXT,
  ADD COLUMN IF NOT EXISTS arrival_airport TEXT,
  ADD COLUMN IF NOT EXISTS flight_type TEXT DEFAULT 'one_way',
  ADD COLUMN IF NOT EXISTS num_legs INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS luggage_estimate TEXT,
  ADD COLUMN IF NOT EXISTS catering_requests TEXT,
  ADD COLUMN IF NOT EXISTS pet_friendly BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_cb_booking_requests_category ON public.cb_booking_requests(category);

ALTER TABLE public.cb_partner_quotes
  ADD COLUMN IF NOT EXISTS aircraft_type TEXT,
  ADD COLUMN IF NOT EXISTS flight_time_hours NUMERIC,
  ADD COLUMN IF NOT EXISTS reposition_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fuel_surcharge NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS landing_fees NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS crew_overnight NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS segment_details JSONB;

ALTER TABLE public.tt_partners
  ADD COLUMN IF NOT EXISTS country TEXT;
