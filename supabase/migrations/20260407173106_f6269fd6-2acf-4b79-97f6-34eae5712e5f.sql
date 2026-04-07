
-- ============================================
-- TOPTIER MEDIA ENGINE
-- ============================================

-- 1. media_creators
CREATE TABLE public.media_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  full_name TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT 'photographer',
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  city TEXT,
  state TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  service_radius_miles NUMERIC DEFAULT 25,
  is_available BOOLEAN DEFAULT true,
  rating NUMERIC DEFAULT 5.0,
  portfolio_url TEXT,
  profile_image_url TEXT,
  phone TEXT,
  email TEXT,
  bio TEXT,
  equipment_list TEXT[],
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.media_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can browse creators"
  ON public.media_creators FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Creators can update own profile"
  ON public.media_creators FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert creators"
  ON public.media_creators FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX idx_media_creators_city ON public.media_creators(city);
CREATE INDEX idx_media_creators_available ON public.media_creators(is_available);
CREATE INDEX idx_media_creators_geo ON public.media_creators(latitude, longitude);

-- 2. media_bookings
CREATE TABLE public.media_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  creator_id UUID REFERENCES public.media_creators(id),
  status TEXT NOT NULL DEFAULT 'requested',
  event_type TEXT,
  event_date TIMESTAMPTZ,
  duration_hours NUMERIC DEFAULT 2,
  city TEXT,
  state TEXT,
  location_address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  guest_count INT,
  notes TEXT,
  quoted_price NUMERIC,
  final_price NUMERIC,
  payment_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.media_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings"
  ON public.media_bookings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Creators can view assigned bookings"
  ON public.media_bookings FOR SELECT
  TO authenticated USING (
    creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create bookings"
  ON public.media_bookings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookings"
  ON public.media_bookings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Creators can update assigned bookings"
  ON public.media_bookings FOR UPDATE
  TO authenticated USING (
    creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid())
  );

CREATE INDEX idx_media_bookings_status ON public.media_bookings(status);
CREATE INDEX idx_media_bookings_user ON public.media_bookings(user_id);
CREATE INDEX idx_media_bookings_creator ON public.media_bookings(creator_id);

-- 3. media_dispatch_log
CREATE TABLE public.media_dispatch_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.media_bookings(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES public.media_creators(id),
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.media_dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking owner or creator can view dispatch logs"
  ON public.media_dispatch_log FOR SELECT
  TO authenticated USING (
    booking_id IN (
      SELECT id FROM public.media_bookings
      WHERE user_id = auth.uid()
         OR creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Authenticated can insert dispatch logs"
  ON public.media_dispatch_log FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX idx_dispatch_booking ON public.media_dispatch_log(booking_id);

-- Timestamp trigger
CREATE TRIGGER update_media_creators_updated_at
  BEFORE UPDATE ON public.media_creators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_media_bookings_updated_at
  BEFORE UPDATE ON public.media_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
