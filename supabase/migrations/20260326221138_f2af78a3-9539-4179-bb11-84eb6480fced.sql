
-- ═══════════════════════════════════════════════
-- VENUE MODULE: Full production schema
-- ═══════════════════════════════════════════════

-- Venue Profiles (extends partner with venue-specific data)
CREATE TABLE public.ut_partner_venue_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL UNIQUE,
  venue_name TEXT NOT NULL DEFAULT '',
  headline TEXT,
  full_description TEXT,
  venue_type TEXT DEFAULT 'event_hall',
  full_address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  geo_lat NUMERIC,
  geo_lng NUMERIC,
  phone TEXT,
  email TEXT,
  website TEXT,
  capacity_min INT,
  capacity_max INT,
  price_range_min NUMERIC,
  price_range_max NUMERIC,
  minimum_hours INT DEFAULT 4,
  parking_info TEXT,
  valet_available BOOLEAN DEFAULT false,
  accessibility_features JSONB DEFAULT '[]',
  indoor_outdoor TEXT DEFAULT 'indoor',
  alcohol_policy TEXT,
  outside_catering_allowed BOOLEAN DEFAULT true,
  decoration_policy TEXT,
  sound_policy TEXT,
  cleanup_policy TEXT,
  security_required BOOLEAN DEFAULT false,
  featured_amenities JSONB DEFAULT '[]',
  house_rules TEXT,
  cancellation_policy TEXT,
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  tour_type TEXT,
  tour_embed_url TEXT,
  tour_preview_thumbnail TEXT,
  publish_readiness_score INT DEFAULT 0,
  publish_readiness_reasons JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Venue Spaces (multi-space support)
CREATE TABLE public.ut_partner_venue_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.ut_partner_venue_profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  space_type TEXT DEFAULT 'hall',
  seated_capacity INT,
  standing_capacity INT,
  min_price NUMERIC,
  max_price NUMERIC,
  minimum_hours INT DEFAULT 4,
  amenities JSONB DEFAULT '[]',
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Venue Media
CREATE TABLE public.ut_partner_venue_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.ut_partner_venue_profiles(id) ON DELETE CASCADE NOT NULL,
  space_id UUID REFERENCES public.ut_partner_venue_spaces(id) ON DELETE SET NULL,
  media_type TEXT DEFAULT 'image',
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  caption TEXT,
  is_cover BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  quality_score INT DEFAULT 50,
  ai_tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Venue Availability
CREATE TABLE public.ut_partner_venue_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.ut_partner_venue_profiles(id) ON DELETE CASCADE NOT NULL,
  space_id UUID REFERENCES public.ut_partner_venue_spaces(id) ON DELETE SET NULL,
  available_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  status TEXT DEFAULT 'available',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Venue Packages
CREATE TABLE public.ut_partner_venue_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.ut_partner_venue_profiles(id) ON DELETE CASCADE NOT NULL,
  space_id UUID REFERENCES public.ut_partner_venue_spaces(id) ON DELETE SET NULL,
  package_name TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  package_type TEXT DEFAULT 'custom',
  included_items JSONB DEFAULT '[]',
  add_on_options JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════
-- PARTY RENTAL MODULE: Full production schema
-- ═══════════════════════════════════════════════

-- Rental Company Profile
CREATE TABLE public.ut_partner_rental_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name TEXT NOT NULL DEFAULT '',
  headline TEXT,
  description TEXT,
  service_radius INT,
  delivery_policy TEXT,
  setup_policy TEXT,
  pickup_policy TEXT,
  deposit_policy TEXT,
  damage_policy TEXT,
  minimum_order_amount NUMERIC DEFAULT 0,
  emergency_fee_rules TEXT,
  is_published BOOLEAN DEFAULT false,
  publish_readiness_score INT DEFAULT 0,
  publish_readiness_reasons JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Rental Items (full inventory)
CREATE TABLE public.ut_partner_rental_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  sku TEXT,
  item_name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'other',
  subcategory TEXT,
  quantity_available INT DEFAULT 1,
  quantity_reserved INT DEFAULT 0,
  color TEXT,
  style TEXT,
  material TEXT,
  dimensions TEXT,
  setup_required BOOLEAN DEFAULT false,
  delivery_required BOOLEAN DEFAULT false,
  cost_basis NUMERIC,
  rental_price NUMERIC,
  replacement_value NUMERIC,
  cleaning_fee NUMERIC DEFAULT 0,
  setup_fee NUMERIC DEFAULT 0,
  delivery_fee NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  ai_tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Rental Item Media
CREATE TABLE public.ut_partner_rental_item_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_item_id UUID REFERENCES public.ut_partner_rental_items(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  is_cover BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  quality_score INT DEFAULT 50,
  ai_tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rental Packages/Bundles
CREATE TABLE public.ut_partner_rental_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  package_price NUMERIC,
  included_items JSONB DEFAULT '[]',
  optional_add_ons JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Rental Reservations
CREATE TABLE public.ut_partner_rental_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_item_id UUID REFERENCES public.ut_partner_rental_items(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID,
  reserved_from DATE NOT NULL,
  reserved_to DATE NOT NULL,
  quantity_reserved INT DEFAULT 1,
  status TEXT DEFAULT 'held',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════

ALTER TABLE public.ut_partner_venue_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_venue_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_venue_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_venue_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_venue_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_rental_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_rental_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_rental_item_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_rental_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_rental_reservations ENABLE ROW LEVEL SECURITY;

-- Venue policies
CREATE POLICY "venue_profiles_all" ON public.ut_partner_venue_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "venue_spaces_all" ON public.ut_partner_venue_spaces FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "venue_media_all" ON public.ut_partner_venue_media FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "venue_availability_all" ON public.ut_partner_venue_availability FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "venue_packages_all" ON public.ut_partner_venue_packages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Rental policies
CREATE POLICY "rental_profiles_all" ON public.ut_partner_rental_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rental_items_all" ON public.ut_partner_rental_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rental_item_media_all" ON public.ut_partner_rental_item_media FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rental_packages_all" ON public.ut_partner_rental_packages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "rental_reservations_all" ON public.ut_partner_rental_reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_venue_spaces_venue ON public.ut_partner_venue_spaces(venue_id);
CREATE INDEX idx_venue_media_venue ON public.ut_partner_venue_media(venue_id);
CREATE INDEX idx_venue_avail_venue_date ON public.ut_partner_venue_availability(venue_id, available_date);
CREATE INDEX idx_venue_packages_venue ON public.ut_partner_venue_packages(venue_id);
CREATE INDEX idx_rental_items_partner ON public.ut_partner_rental_items(partner_id);
CREATE INDEX idx_rental_items_category ON public.ut_partner_rental_items(category);
CREATE INDEX idx_rental_media_item ON public.ut_partner_rental_item_media(rental_item_id);
CREATE INDEX idx_rental_packages_partner ON public.ut_partner_rental_packages(partner_id);
CREATE INDEX idx_rental_reservations_item ON public.ut_partner_rental_reservations(rental_item_id);
CREATE INDEX idx_rental_reservations_dates ON public.ut_partner_rental_reservations(reserved_from, reserved_to);
