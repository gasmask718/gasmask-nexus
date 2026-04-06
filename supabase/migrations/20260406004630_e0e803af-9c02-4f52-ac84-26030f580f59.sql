
-- Decor style catalog
CREATE TABLE public.vehicle_decor_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  media JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_decor_styles_category ON public.vehicle_decor_styles(category);
ALTER TABLE public.vehicle_decor_styles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage decor styles" ON public.vehicle_decor_styles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Decorator providers
CREATE TABLE public.decor_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  specialties TEXT[] DEFAULT '{}',
  price_range TEXT,
  media JSONB DEFAULT '[]'::jsonb,
  rating NUMERIC(3,2) DEFAULT 0,
  bio TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  independent_contractor BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_decor_providers_city ON public.decor_providers(city);
ALTER TABLE public.decor_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage decor providers" ON public.decor_providers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add-on items
CREATE TABLE public.decor_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.decor_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage decor addons" ON public.decor_addons FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Bookings
CREATE TABLE public.decor_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  provider_id UUID REFERENCES public.decor_providers(id) ON DELETE SET NULL,
  style_id UUID REFERENCES public.vehicle_decor_styles(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.tt_vehicles(id) ON DELETE SET NULL,
  external_vehicle TEXT,
  service_type TEXT NOT NULL DEFAULT 'mobile' CHECK (service_type IN ('mobile','dropoff')),
  location TEXT,
  event_type TEXT,
  customization_data JSONB DEFAULT '{}'::jsonb,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','confirmed','in_progress','completed','cancelled','declined')),
  scheduled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_decor_bookings_provider ON public.decor_bookings(provider_id);
CREATE INDEX idx_decor_bookings_status ON public.decor_bookings(status);
ALTER TABLE public.decor_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage decor bookings" ON public.decor_bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Booking add-ons junction
CREATE TABLE public.decor_booking_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.decor_bookings(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES public.decor_addons(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_decor_booking_addons_booking ON public.decor_booking_addons(booking_id);
ALTER TABLE public.decor_booking_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage decor booking addons" ON public.decor_booking_addons FOR ALL TO authenticated USING (true) WITH CHECK (true);
