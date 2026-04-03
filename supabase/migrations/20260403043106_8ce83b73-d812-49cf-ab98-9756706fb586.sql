
-- TopTier Bookings
CREATE TABLE public.tt_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  service_type TEXT NOT NULL DEFAULT 'luxury_transport',
  service_name TEXT NOT NULL,
  total_price NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ,
  partner_id UUID,
  partner_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tt_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage tt_bookings"
  ON public.tt_bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TopTier Partners
CREATE TABLE public.tt_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  business_name TEXT,
  email TEXT,
  phone TEXT,
  service_category TEXT NOT NULL DEFAULT 'transport',
  status TEXT NOT NULL DEFAULT 'pending',
  trust_score INTEGER NOT NULL DEFAULT 3,
  total_bookings INTEGER NOT NULL DEFAULT 0,
  total_earnings NUMERIC NOT NULL DEFAULT 0,
  response_rate NUMERIC NOT NULL DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tt_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage tt_partners"
  ON public.tt_partners FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TopTier Confirmation Requests
CREATE TABLE public.tt_confirmation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.tt_bookings(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.tt_partners(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tt_confirmation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage tt_confirmation_requests"
  ON public.tt_confirmation_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TopTier Booking Events (audit trail)
CREATE TABLE public.tt_booking_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.tt_bookings(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  actor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tt_booking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage tt_booking_events"
  ON public.tt_booking_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TopTier Partner Earnings
CREATE TABLE public.tt_partner_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID REFERENCES public.tt_partners(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID REFERENCES public.tt_bookings(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tt_partner_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage tt_partner_earnings"
  ON public.tt_partner_earnings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add foreign key from bookings to partners
ALTER TABLE public.tt_bookings ADD CONSTRAINT tt_bookings_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.tt_partners(id) ON DELETE SET NULL;

-- Enable realtime for bookings
ALTER PUBLICATION supabase_realtime ADD TABLE public.tt_bookings;

-- Indexes for performance
CREATE INDEX idx_tt_bookings_status ON public.tt_bookings(status);
CREATE INDEX idx_tt_bookings_created_at ON public.tt_bookings(created_at DESC);
CREATE INDEX idx_tt_bookings_partner_id ON public.tt_bookings(partner_id);
CREATE INDEX idx_tt_partners_status ON public.tt_partners(status);
CREATE INDEX idx_tt_confirmation_requests_status ON public.tt_confirmation_requests(status);
CREATE INDEX idx_tt_partner_earnings_status ON public.tt_partner_earnings(status);
