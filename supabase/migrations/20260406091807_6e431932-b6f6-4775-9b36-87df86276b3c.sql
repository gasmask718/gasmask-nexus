
-- Beauty Providers
CREATE TABLE public.beauty_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('makeup', 'hair', 'nails', 'barber')),
  city TEXT,
  state TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  service_radius_miles INTEGER NOT NULL DEFAULT 25,
  license_verified BOOLEAN NOT NULL DEFAULT false,
  insurance_verified BOOLEAN NOT NULL DEFAULT false,
  rating NUMERIC(3,2) DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  bio TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beauty_providers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_beauty_providers_category ON public.beauty_providers(category);
CREATE INDEX idx_beauty_providers_city ON public.beauty_providers(city);
CREATE INDEX idx_beauty_providers_active ON public.beauty_providers(is_active);

CREATE POLICY "Public can view active providers" ON public.beauty_providers FOR SELECT USING (true);
CREATE POLICY "Providers can update own profile" ON public.beauty_providers FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can create provider" ON public.beauty_providers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Provider Services
CREATE TABLE public.provider_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.beauty_providers(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_services ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_provider_services_provider ON public.provider_services(provider_id);

CREATE POLICY "Public can view services" ON public.provider_services FOR SELECT USING (true);
CREATE POLICY "Providers manage own services" ON public.provider_services FOR ALL TO authenticated
  USING (provider_id IN (SELECT id FROM public.beauty_providers WHERE user_id = auth.uid()))
  WITH CHECK (provider_id IN (SELECT id FROM public.beauty_providers WHERE user_id = auth.uid()));

-- Provider Media
CREATE TABLE public.provider_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.beauty_providers(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
  url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_media ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_provider_media_provider ON public.provider_media(provider_id);

CREATE POLICY "Public can view media" ON public.provider_media FOR SELECT USING (true);
CREATE POLICY "Providers manage own media" ON public.provider_media FOR ALL TO authenticated
  USING (provider_id IN (SELECT id FROM public.beauty_providers WHERE user_id = auth.uid()))
  WITH CHECK (provider_id IN (SELECT id FROM public.beauty_providers WHERE user_id = auth.uid()));

-- Provider Reviews
CREATE TABLE public.provider_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.beauty_providers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_provider_reviews_provider ON public.provider_reviews(provider_id);

CREATE POLICY "Public can view reviews" ON public.provider_reviews FOR SELECT USING (true);
CREATE POLICY "Users create own reviews" ON public.provider_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reviews" ON public.provider_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own reviews" ON public.provider_reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Beauty Bookings
CREATE TABLE public.beauty_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  provider_id UUID NOT NULL REFERENCES public.beauty_providers(id),
  service_id UUID REFERENCES public.provider_services(id),
  service_name TEXT NOT NULL,
  location_address TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  booking_time TIMESTAMPTZ NOT NULL,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled','declined')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.beauty_bookings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_beauty_bookings_user ON public.beauty_bookings(user_id);
CREATE INDEX idx_beauty_bookings_provider ON public.beauty_bookings(provider_id);
CREATE INDEX idx_beauty_bookings_status ON public.beauty_bookings(status);

CREATE POLICY "Users view own bookings" ON public.beauty_bookings FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR provider_id IN (SELECT id FROM public.beauty_providers WHERE user_id = auth.uid()));
CREATE POLICY "Users create bookings" ON public.beauty_bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Booking parties can update" ON public.beauty_bookings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR provider_id IN (SELECT id FROM public.beauty_providers WHERE user_id = auth.uid()));

-- Triggers
CREATE TRIGGER update_beauty_providers_updated_at BEFORE UPDATE ON public.beauty_providers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_beauty_bookings_updated_at BEFORE UPDATE ON public.beauty_bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Geospatial matching RPC
CREATE OR REPLACE FUNCTION public.match_beauty_providers_by_location(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_category TEXT DEFAULT NULL,
  p_max_distance DOUBLE PRECISION DEFAULT 50
)
RETURNS TABLE (
  provider_id UUID,
  provider_name TEXT,
  category TEXT,
  city TEXT,
  distance_miles DOUBLE PRECISION,
  rating NUMERIC,
  total_reviews INTEGER,
  service_radius INTEGER
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    bp.id,
    bp.name,
    bp.category,
    bp.city,
    public.calculate_distance_miles(p_lat, p_lng, bp.lat, bp.lng) AS distance_miles,
    bp.rating,
    bp.total_reviews,
    bp.service_radius_miles
  FROM public.beauty_providers bp
  WHERE bp.is_active = true
    AND bp.lat IS NOT NULL AND bp.lng IS NOT NULL
    AND public.calculate_distance_miles(p_lat, p_lng, bp.lat, bp.lng) <= LEAST(bp.service_radius_miles, p_max_distance)
    AND (p_category IS NULL OR bp.category = p_category)
  ORDER BY distance_miles ASC;
END;
$$;
