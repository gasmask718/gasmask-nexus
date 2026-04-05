
-- Nightlife Partners (promoters & clubs)
CREATE TABLE public.nightlife_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'promoter' CHECK (role IN ('promoter', 'club')),
  bio TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nightlife_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active partners"
  ON public.nightlife_partners FOR SELECT USING (true);

CREATE POLICY "Authenticated can insert partners"
  ON public.nightlife_partners FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update partners"
  ON public.nightlife_partners FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete partners"
  ON public.nightlife_partners FOR DELETE TO authenticated USING (true);

-- Nightlife Requests (VIP requests from users)
CREATE TABLE public.nightlife_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  city TEXT NOT NULL,
  venue TEXT,
  party_size INTEGER NOT NULL DEFAULT 1,
  date DATE NOT NULL,
  request_details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'counter_offer')),
  assigned_promoter_id UUID REFERENCES public.nightlife_partners(id) ON DELETE SET NULL,
  counter_offer_details TEXT,
  counter_offer_price NUMERIC,
  promoter_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nightlife_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view requests"
  ON public.nightlife_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone can insert requests"
  ON public.nightlife_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated can update requests"
  ON public.nightlife_requests FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete requests"
  ON public.nightlife_requests FOR DELETE TO authenticated USING (true);

-- Nightlife Bookings (confirmed deals)
CREATE TABLE public.nightlife_bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.nightlife_requests(id) ON DELETE CASCADE,
  final_price NUMERIC,
  confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nightlife_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view bookings"
  ON public.nightlife_bookings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert bookings"
  ON public.nightlife_bookings FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update bookings"
  ON public.nightlife_bookings FOR UPDATE TO authenticated USING (true);

-- Index for fast lookups
CREATE INDEX idx_nightlife_requests_status ON public.nightlife_requests(status);
CREATE INDEX idx_nightlife_requests_promoter ON public.nightlife_requests(assigned_promoter_id);
CREATE INDEX idx_nightlife_bookings_request ON public.nightlife_bookings(request_id);

-- Enable realtime for requests (promoters see updates live)
ALTER PUBLICATION supabase_realtime ADD TABLE public.nightlife_requests;
