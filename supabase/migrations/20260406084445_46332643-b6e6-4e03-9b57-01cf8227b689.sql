
-- Decorators table
CREATE TABLE public.decorators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  service_radius_miles INTEGER NOT NULL DEFAULT 25,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  base_price_min NUMERIC(10,2) DEFAULT 0,
  base_price_max NUMERIC(10,2) DEFAULT 0,
  bio TEXT,
  portfolio_images TEXT[] DEFAULT '{}',
  rating NUMERIC(3,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.decorators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Decorators are viewable by authenticated users"
  ON public.decorators FOR SELECT TO authenticated USING (true);

CREATE POLICY "Decorators can update own profile"
  ON public.decorators FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Decorators can insert own profile"
  ON public.decorators FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Decorators can delete own profile"
  ON public.decorators FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Decor requests table
CREATE TABLE public.decor_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_location TEXT NOT NULL,
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  city TEXT,
  state TEXT,
  zip TEXT,
  room_type TEXT,
  occasion TEXT NOT NULL,
  description TEXT,
  uploaded_images TEXT[] DEFAULT '{}',
  event_date DATE,
  budget_min NUMERIC(10,2),
  budget_max NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'quoted', 'booked', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.decor_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests"
  ON public.decor_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Decorators can view open requests"
  ON public.decor_requests FOR SELECT TO authenticated USING (status = 'open');

CREATE POLICY "Users can create requests"
  ON public.decor_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own requests"
  ON public.decor_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Decorator quotes table
CREATE TABLE public.decorator_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.decor_requests(id) ON DELETE CASCADE NOT NULL,
  decorator_id UUID REFERENCES public.decorators(id) ON DELETE CASCADE NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  notes TEXT,
  estimated_hours NUMERIC(5,1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(request_id, decorator_id)
);

ALTER TABLE public.decorator_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Request owners can view quotes"
  ON public.decorator_quotes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.decor_requests r WHERE r.id = request_id AND r.user_id = auth.uid()));

CREATE POLICY "Decorators can view own quotes"
  ON public.decorator_quotes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.decorators d WHERE d.id = decorator_id AND d.user_id = auth.uid()));

CREATE POLICY "Decorators can insert quotes"
  ON public.decorator_quotes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.decorators d WHERE d.id = decorator_id AND d.user_id = auth.uid()));

CREATE POLICY "Decorators can update own quotes"
  ON public.decorator_quotes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.decorators d WHERE d.id = decorator_id AND d.user_id = auth.uid()));

-- Decor marketplace bookings
CREATE TABLE public.decor_marketplace_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.decor_requests(id) ON DELETE CASCADE NOT NULL UNIQUE,
  quote_id UUID REFERENCES public.decorator_quotes(id) ON DELETE CASCADE NOT NULL,
  decorator_id UUID REFERENCES public.decorators(id) ON DELETE CASCADE NOT NULL,
  final_price NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.decor_marketplace_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Request owners can view bookings"
  ON public.decor_marketplace_bookings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.decor_requests r WHERE r.id = request_id AND r.user_id = auth.uid()));

CREATE POLICY "Decorators can view own bookings"
  ON public.decor_marketplace_bookings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.decorators d WHERE d.id = decorator_id AND d.user_id = auth.uid()));

CREATE POLICY "Users can create bookings"
  ON public.decor_marketplace_bookings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.decor_requests r WHERE r.id = request_id AND r.user_id = auth.uid()));

CREATE POLICY "Booking parties can update"
  ON public.decor_marketplace_bookings FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.decor_requests r WHERE r.id = request_id AND r.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.decorators d WHERE d.id = decorator_id AND d.user_id = auth.uid())
  );

-- Matching function for decorators by location
CREATE OR REPLACE FUNCTION public.match_decorators_by_location(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_occasion TEXT DEFAULT NULL
)
RETURNS TABLE (
  decorator_id UUID,
  decorator_name TEXT,
  city TEXT,
  specialties TEXT[],
  distance_miles DOUBLE PRECISION,
  service_radius INTEGER,
  base_price_min NUMERIC,
  base_price_max NUMERIC,
  rating NUMERIC
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.name,
    d.city,
    d.specialties,
    public.calculate_distance_miles(p_lat, p_lng, d.lat, d.lng) AS distance_miles,
    d.service_radius_miles,
    d.base_price_min,
    d.base_price_max,
    d.rating
  FROM public.decorators d
  WHERE d.is_active = true
    AND d.lat IS NOT NULL AND d.lng IS NOT NULL
    AND public.calculate_distance_miles(p_lat, p_lng, d.lat, d.lng) <= d.service_radius_miles
    AND (p_occasion IS NULL OR p_occasion = ANY(d.specialties))
  ORDER BY distance_miles ASC;
END;
$$;

-- Indexes
CREATE INDEX idx_decorators_city ON public.decorators(city);
CREATE INDEX idx_decorators_active ON public.decorators(is_active) WHERE is_active = true;
CREATE INDEX idx_decor_requests_status ON public.decor_requests(status);
CREATE INDEX idx_decor_requests_user ON public.decor_requests(user_id);
CREATE INDEX idx_decorator_quotes_request ON public.decorator_quotes(request_id);
CREATE INDEX idx_decorator_quotes_decorator ON public.decorator_quotes(decorator_id);

-- Timestamp triggers
CREATE TRIGGER update_decorators_updated_at BEFORE UPDATE ON public.decorators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_decor_requests_updated_at BEFORE UPDATE ON public.decor_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_decorator_quotes_updated_at BEFORE UPDATE ON public.decorator_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_decor_marketplace_bookings_updated_at BEFORE UPDATE ON public.decor_marketplace_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
