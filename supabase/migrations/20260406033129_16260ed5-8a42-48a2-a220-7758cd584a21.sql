
-- Unified fleet vehicle table
CREATE TABLE public.fleet_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'sedan',
  capacity INTEGER NOT NULL DEFAULT 4,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  minimum_hours INTEGER NOT NULL DEFAULT 1,
  images TEXT[] DEFAULT '{}',
  city TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Experience flags
  available_for_chauffeur BOOLEAN NOT NULL DEFAULT false,
  available_for_decor BOOLEAN NOT NULL DEFAULT false,
  available_for_nightlife BOOLEAN NOT NULL DEFAULT false,

  -- Decor compatibility
  decor_compatible BOOLEAN NOT NULL DEFAULT false,
  decor_tags TEXT[] DEFAULT '{}',

  -- Nightlife compatibility
  nightlife_ready BOOLEAN NOT NULL DEFAULT false,
  vip_transport BOOLEAN NOT NULL DEFAULT false,

  -- Chauffeur settings
  chauffeur_only BOOLEAN NOT NULL DEFAULT false,
  driver_required BOOLEAN NOT NULL DEFAULT true,

  -- Pricing overrides
  decor_price_override NUMERIC(10,2),
  nightlife_price_override NUMERIC(10,2),

  -- Metadata
  description TEXT,
  make TEXT,
  model TEXT,
  year INTEGER,
  plate_number TEXT,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fleet_vehicles_city ON public.fleet_vehicles(city);
CREATE INDEX idx_fleet_vehicles_category ON public.fleet_vehicles(category);
CREATE INDEX idx_fleet_vehicles_chauffeur ON public.fleet_vehicles(available_for_chauffeur) WHERE available_for_chauffeur = true;
CREATE INDEX idx_fleet_vehicles_decor ON public.fleet_vehicles(available_for_decor) WHERE available_for_decor = true;
CREATE INDEX idx_fleet_vehicles_nightlife ON public.fleet_vehicles(available_for_nightlife) WHERE available_for_nightlife = true;

ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage fleet vehicles" ON public.fleet_vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fleet bookings table
CREATE TABLE public.fleet_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  experience_type TEXT NOT NULL, -- chauffeur, decor, nightlife
  source_booking_id UUID, -- references the experience-specific booking
  user_id UUID,
  pickup_location TEXT,
  dropoff_location TEXT,
  scheduled_at TIMESTAMPTZ,
  duration_hours INTEGER DEFAULT 1,
  pricing_snapshot JSONB DEFAULT '{}',
  total_price NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fleet_bookings_vehicle ON public.fleet_bookings(vehicle_id);
CREATE INDEX idx_fleet_bookings_type ON public.fleet_bookings(experience_type);
CREATE INDEX idx_fleet_bookings_status ON public.fleet_bookings(status);

ALTER TABLE public.fleet_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage fleet bookings" ON public.fleet_bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed fleet with sample vehicles
INSERT INTO public.fleet_vehicles (name, category, capacity, hourly_rate, minimum_hours, city, make, model, year, color, available_for_chauffeur, available_for_decor, available_for_nightlife, decor_compatible, decor_tags, nightlife_ready, vip_transport) VALUES
('Black Escalade ESV', 'SUV', 7, 150, 3, 'Miami', 'Cadillac', 'Escalade ESV', 2024, 'Black', true, true, true, true, ARRAY['luxury','corporate'], true, true),
('Mercedes Sprinter Party Bus', 'sprinter', 14, 250, 4, 'Miami', 'Mercedes-Benz', 'Sprinter', 2024, 'White', false, true, true, true, ARRAY['party','romantic'], true, true),
('Rolls Royce Ghost', 'exotic', 4, 500, 3, 'Miami', 'Rolls Royce', 'Ghost', 2024, 'White', true, true, false, true, ARRAY['luxury','romantic','corporate'], false, false),
('Lamborghini Urus', 'exotic', 4, 400, 2, 'Atlanta', 'Lamborghini', 'Urus', 2024, 'Yellow', true, false, true, false, '{}', true, true),
('Lincoln Navigator L', 'SUV', 7, 120, 3, 'NYC', 'Lincoln', 'Navigator L', 2024, 'Black', true, true, true, true, ARRAY['corporate','luxury'], true, false),
('Party Bus XL', 'sprinter', 20, 350, 4, 'Atlanta', 'Ford', 'F-650 Custom', 2023, 'Black', false, true, true, true, ARRAY['party'], true, true),
('Bentley Continental GT', 'exotic', 2, 450, 2, 'NYC', 'Bentley', 'Continental GT', 2024, 'Silver', true, false, false, false, '{}', false, false),
('Range Rover Autobiography', 'SUV', 5, 200, 3, 'Miami', 'Land Rover', 'Range Rover', 2024, 'Black', true, true, true, true, ARRAY['luxury','corporate'], true, false);
