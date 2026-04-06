
-- Experiences Master Catalog
CREATE TABLE public.experiences_master (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  city TEXT,
  category TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  rating NUMERIC(3,2),
  duration TEXT,
  supplier_name TEXT,
  booking_type TEXT NOT NULL DEFAULT 'external',
  external_url TEXT,
  markup_pct NUMERIC(5,2) NOT NULL DEFAULT 15,
  display_price NUMERIC(10,2) GENERATED ALWAYS AS (price * (1 + markup_pct / 100)) STORED,
  tags TEXT[],
  image_url TEXT,
  viator_product_code TEXT UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.experiences_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view experiences"
  ON public.experiences_master FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role manages experiences"
  ON public.experiences_master FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Experience Bookings
CREATE TABLE public.experience_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  experience_id UUID NOT NULL REFERENCES public.experiences_master(id) ON DELETE CASCADE,
  selected_addons JSONB DEFAULT '[]'::jsonb,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  booking_status TEXT NOT NULL DEFAULT 'pending',
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.experience_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings"
  ON public.experience_bookings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create bookings"
  ON public.experience_bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages bookings"
  ON public.experience_bookings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Sync Error Log
CREATE TABLE public.experience_sync_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  error_type TEXT NOT NULL,
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.experience_sync_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sync errors"
  ON public.experience_sync_errors FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role manages sync errors"
  ON public.experience_sync_errors FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Realtime for bookings
ALTER PUBLICATION supabase_realtime ADD TABLE public.experience_bookings;

-- Updated-at triggers
CREATE TRIGGER update_experiences_master_updated_at
  BEFORE UPDATE ON public.experiences_master
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_experience_bookings_updated_at
  BEFORE UPDATE ON public.experience_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
