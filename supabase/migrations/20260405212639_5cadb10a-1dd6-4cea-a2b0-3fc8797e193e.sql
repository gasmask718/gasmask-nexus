
-- 1. Hotel Suppliers
CREATE TABLE public.tt_hotel_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  api_type text NOT NULL DEFAULT 'mock',
  status text NOT NULL DEFAULT 'active',
  credentials_configured boolean NOT NULL DEFAULT false,
  payout_model text DEFAULT 'net_rate',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tt_hotel_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on tt_hotel_suppliers" ON public.tt_hotel_suppliers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Hotels
CREATE TABLE public.tt_hotels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.tt_hotel_suppliers(id) ON DELETE SET NULL,
  supplier_hotel_id text,
  name text NOT NULL,
  city text NOT NULL,
  address text,
  description text,
  star_rating numeric(2,1) DEFAULT 5.0,
  review_score numeric(3,1),
  hero_image text,
  gallery jsonb DEFAULT '[]',
  amenities text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  inventory_mode text NOT NULL DEFAULT 'mock',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tt_hotels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on tt_hotels" ON public.tt_hotels FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read active hotels" ON public.tt_hotels FOR SELECT TO authenticated USING (is_active = true);

-- 3. Room Offers
CREATE TABLE public.tt_hotel_room_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.tt_hotels(id) ON DELETE CASCADE,
  supplier_offer_id text,
  room_name text NOT NULL,
  occupancy int NOT NULL DEFAULT 2,
  bed_type text DEFAULT 'King',
  refund_policy text DEFAULT 'Non-refundable',
  included_perks text[] DEFAULT '{}',
  nightly_price numeric(10,2) NOT NULL,
  total_price numeric(10,2),
  currency text NOT NULL DEFAULT 'USD',
  is_refundable boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tt_hotel_room_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on tt_hotel_room_offers" ON public.tt_hotel_room_offers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read active room offers" ON public.tt_hotel_room_offers FOR SELECT TO authenticated USING (is_active = true);

-- 4. Add-ons
CREATE TABLE public.tt_hotel_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text DEFAULT 'general',
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tt_hotel_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on tt_hotel_addons" ON public.tt_hotel_addons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read active addons" ON public.tt_hotel_addons FOR SELECT TO authenticated USING (is_active = true);

-- 5. Booking Requests
CREATE TABLE public.tt_hotel_booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hotel_id uuid NOT NULL REFERENCES public.tt_hotels(id),
  room_offer_id uuid REFERENCES public.tt_hotel_room_offers(id),
  check_in date NOT NULL,
  check_out date NOT NULL,
  guests int NOT NULL DEFAULT 1,
  selected_addons jsonb DEFAULT '[]',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  taxes_estimate numeric(10,2) DEFAULT 0,
  service_fee numeric(10,2) DEFAULT 0,
  markup numeric(10,2) DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  supplier_payout numeric(10,2) DEFAULT 0,
  commission numeric(10,2) DEFAULT 0,
  addon_revenue numeric(10,2) DEFAULT 0,
  deposit_amount numeric(10,2) DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid',
  payout_status text NOT NULL DEFAULT 'pending',
  status text NOT NULL DEFAULT 'pending',
  source text DEFAULT 'penthouse',
  supplier text,
  supplier_booking_reference text,
  itinerary_synced boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tt_hotel_booking_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on tt_hotel_booking_requests" ON public.tt_hotel_booking_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read own bookings" ON public.tt_hotel_booking_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own bookings" ON public.tt_hotel_booking_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_tt_hotels_city ON public.tt_hotels(city);
CREATE INDEX idx_tt_hotels_active ON public.tt_hotels(is_active);
CREATE INDEX idx_tt_hotel_room_offers_hotel ON public.tt_hotel_room_offers(hotel_id);
CREATE INDEX idx_tt_hotel_booking_requests_user ON public.tt_hotel_booking_requests(user_id);
CREATE INDEX idx_tt_hotel_booking_requests_status ON public.tt_hotel_booking_requests(status);

-- Realtime for bookings
ALTER PUBLICATION supabase_realtime ADD TABLE public.tt_hotel_booking_requests;
