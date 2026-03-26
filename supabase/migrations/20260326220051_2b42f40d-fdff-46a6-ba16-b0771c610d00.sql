
-- =============================================
-- UNFORGETTABLE TIMES PARTNER PORTAL SCHEMA
-- =============================================

-- Partner Categories Enum
CREATE TYPE public.ut_partner_category AS ENUM (
  'event_hall', 'party_rental', 'caterer', 'bartender',
  'decorator', 'photographer', 'videographer', 'dj',
  'florist', 'planner', 'staff_provider', 'entertainment',
  'bakery', 'lighting', 'photo_booth', 'other'
);

CREATE TYPE public.ut_listing_status AS ENUM (
  'draft', 'pending_review', 'published', 'paused', 'rejected'
);

-- =============================================
-- 1) PARTNER PROFILES (Core for all vendors)
-- =============================================
CREATE TABLE public.ut_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  category ut_partner_category NOT NULL DEFAULT 'other',
  subcategories TEXT[] DEFAULT '{}',
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  description TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  address_line1 TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  service_radius_miles INT DEFAULT 25,
  years_in_business INT,
  insurance_verified BOOLEAN DEFAULT false,
  license_verified BOOLEAN DEFAULT false,
  avg_rating NUMERIC(3,2) DEFAULT 0,
  total_reviews INT DEFAULT 0,
  total_bookings INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  onboarding_complete BOOLEAN DEFAULT false,
  profile_completeness INT DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ut_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners can manage own profile" ON public.ut_partners
  FOR ALL TO authenticated USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND primary_role IN ('admin','va','owner')
  ));

-- =============================================
-- 2) PARTNER SERVICES (Shared across all categories)
-- =============================================
CREATE TABLE public.ut_partner_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  service_name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  base_price NUMERIC(10,2),
  price_type TEXT DEFAULT 'flat', -- flat, per_hour, per_guest, per_item, custom
  min_guests INT,
  max_guests INT,
  duration_hours NUMERIC(4,1),
  includes TEXT[],
  add_ons JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ut_partner_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners manage own services" ON public.ut_partner_services
  FOR ALL TO authenticated USING (
    partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND primary_role IN ('admin','va','owner'))
  );

-- =============================================
-- 3) MEDIA LIBRARY (Shared)
-- =============================================
CREATE TABLE public.ut_partner_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_type TEXT DEFAULT 'image', -- image, video, document, floor_plan, virtual_tour
  title TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  category TEXT, -- maps to listing/item
  linked_listing_id UUID,
  linked_item_id UUID,
  is_hero BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  width INT,
  height INT,
  file_size_bytes BIGINT,
  quality_score INT, -- 0-100 AI-assessed
  sort_order INT DEFAULT 0,
  ai_classification TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ut_partner_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners manage own media" ON public.ut_partner_media
  FOR ALL TO authenticated USING (
    partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND primary_role IN ('admin','va','owner'))
  );

-- =============================================
-- 4) LISTINGS (Published marketplace entries)
-- =============================================
CREATE TABLE public.ut_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  listing_type TEXT NOT NULL, -- venue, rental_item, catering_menu, decoration_package, staff_service
  title TEXT NOT NULL,
  slug TEXT,
  subtitle TEXT,
  description TEXT,
  highlights TEXT[] DEFAULT '{}',
  cover_image_url TEXT,
  gallery_urls TEXT[] DEFAULT '{}',
  category TEXT,
  subcategory TEXT,
  tags TEXT[] DEFAULT '{}',
  base_price NUMERIC(10,2),
  price_label TEXT, -- "Starting at $500", "From $25/hr"
  location_city TEXT,
  location_state TEXT,
  event_types TEXT[] DEFAULT '{}', -- wedding, birthday, corporate, etc.
  capacity_min INT,
  capacity_max INT,
  status ut_listing_status DEFAULT 'draft',
  is_featured BOOLEAN DEFAULT false,
  view_count INT DEFAULT 0,
  inquiry_count INT DEFAULT 0,
  booking_count INT DEFAULT 0,
  ai_generated_description TEXT,
  ai_seo_keywords TEXT[],
  ai_quality_score INT,
  category_data JSONB DEFAULT '{}', -- Category-specific fields stored as JSON
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ut_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view published listings" ON public.ut_listings
  FOR SELECT USING (status = 'published');
CREATE POLICY "Partners manage own listings" ON public.ut_listings
  FOR ALL TO authenticated USING (
    partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND primary_role IN ('admin','va','owner'))
  );

-- =============================================
-- 5) VENUE SPACES (Event Hall specific)
-- =============================================
CREATE TABLE public.ut_venue_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES public.ut_listings(id) ON DELETE SET NULL,
  space_name TEXT NOT NULL,
  description TEXT,
  capacity_seated INT,
  capacity_standing INT,
  capacity_theater INT,
  square_footage INT,
  amenities TEXT[] DEFAULT '{}',
  rules TEXT[] DEFAULT '{}',
  floor_plan_url TEXT,
  virtual_tour_url TEXT,
  hourly_rate NUMERIC(10,2),
  half_day_rate NUMERIC(10,2),
  full_day_rate NUMERIC(10,2),
  minimum_hours INT DEFAULT 4,
  outside_catering_allowed BOOLEAN DEFAULT true,
  outside_catering_fee NUMERIC(10,2),
  parking_capacity INT,
  valet_available BOOLEAN DEFAULT false,
  wheelchair_accessible BOOLEAN DEFAULT true,
  event_types_suitable TEXT[] DEFAULT '{}',
  setup_time_hours NUMERIC(3,1) DEFAULT 2,
  cleanup_time_hours NUMERIC(3,1) DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ut_venue_spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners manage own venue spaces" ON public.ut_venue_spaces
  FOR ALL TO authenticated USING (
    partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND primary_role IN ('admin','va','owner'))
  );

-- =============================================
-- 6) RENTAL INVENTORY (Party Rental specific)
-- =============================================
CREATE TABLE public.ut_rental_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES public.ut_listings(id) ON DELETE SET NULL,
  sku TEXT,
  item_name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- chairs, tables, tents, bounce_houses, linens, etc.
  subcategory TEXT,
  color TEXT,
  material TEXT,
  dimensions TEXT,
  quantity_total INT DEFAULT 1,
  quantity_available INT DEFAULT 1,
  rental_price NUMERIC(10,2),
  price_type TEXT DEFAULT 'per_item', -- per_item, per_set, per_day
  delivery_fee NUMERIC(10,2) DEFAULT 0,
  setup_fee NUMERIC(10,2) DEFAULT 0,
  damage_deposit NUMERIC(10,2),
  min_rental_qty INT DEFAULT 1,
  image_urls TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  condition TEXT DEFAULT 'excellent',
  variants JSONB DEFAULT '[]', -- [{color:"gold", qty: 50, price: 5.00}]
  bundle_eligible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ut_rental_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners manage own inventory" ON public.ut_rental_inventory
  FOR ALL TO authenticated USING (
    partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND primary_role IN ('admin','va','owner'))
  );

-- =============================================
-- 7) CATERING MENUS (Caterer/Bartender specific)
-- =============================================
CREATE TABLE public.ut_catering_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES public.ut_listings(id) ON DELETE SET NULL,
  menu_name TEXT NOT NULL,
  cuisine_type TEXT,
  service_style TEXT, -- buffet, plated, family_style, stations, cocktail
  description TEXT,
  price_per_guest NUMERIC(10,2),
  minimum_guests INT DEFAULT 20,
  maximum_guests INT,
  includes TEXT[] DEFAULT '{}',
  courses JSONB DEFAULT '[]', -- [{name: "Appetizer", items: [...]}]
  beverage_packages JSONB DEFAULT '[]',
  dietary_options TEXT[] DEFAULT '{}', -- vegan, halal, kosher, gluten_free
  staffing_included BOOLEAN DEFAULT false,
  staff_per_guests INT, -- 1 staff per N guests
  setup_cleanup_included BOOLEAN DEFAULT false,
  equipment_included BOOLEAN DEFAULT false,
  tasting_available BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ut_catering_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners manage own menus" ON public.ut_catering_menus
  FOR ALL TO authenticated USING (
    partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND primary_role IN ('admin','va','owner'))
  );

-- =============================================
-- 8) PACKAGES & BUNDLES (Shared)
-- =============================================
CREATE TABLE public.ut_partner_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES public.ut_listings(id) ON DELETE SET NULL,
  package_name TEXT NOT NULL,
  description TEXT,
  package_type TEXT DEFAULT 'standard', -- basic, standard, premium, custom
  price NUMERIC(10,2),
  compared_value NUMERIC(10,2), -- "normally $X"
  included_items JSONB DEFAULT '[]', -- [{name, qty, value}]
  add_ons JSONB DEFAULT '[]',
  min_guests INT,
  max_guests INT,
  duration_hours NUMERIC(4,1),
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ut_partner_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners manage own packages" ON public.ut_partner_packages
  FOR ALL TO authenticated USING (
    partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND primary_role IN ('admin','va','owner'))
  );

-- =============================================
-- 9) AVAILABILITY & BLACKOUTS
-- =============================================
CREATE TABLE public.ut_partner_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  status TEXT DEFAULT 'available', -- available, booked, blocked, tentative
  time_start TIME,
  time_end TIME,
  booking_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ut_partner_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners manage own availability" ON public.ut_partner_availability
  FOR ALL TO authenticated USING (
    partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND primary_role IN ('admin','va','owner'))
  );

-- =============================================
-- 10) BOOKINGS / ORDERS
-- =============================================
CREATE TABLE public.ut_partner_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES public.ut_listings(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  event_date DATE,
  event_type TEXT,
  guest_count INT,
  package_id UUID REFERENCES public.ut_partner_packages(id) ON DELETE SET NULL,
  items JSONB DEFAULT '[]',
  subtotal NUMERIC(10,2) DEFAULT 0,
  tax NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  deposit_amount NUMERIC(10,2) DEFAULT 0,
  deposit_paid BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'inquiry', -- inquiry, quoted, confirmed, deposit_paid, in_progress, completed, cancelled
  notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ut_partner_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners manage own bookings" ON public.ut_partner_bookings
  FOR ALL TO authenticated USING (
    partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND primary_role IN ('admin','va','owner'))
  );

-- =============================================
-- 11) LISTING WIZARD STATE
-- =============================================
CREATE TABLE public.ut_listing_wizard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  wizard_step INT DEFAULT 1,
  uploaded_files JSONB DEFAULT '[]',
  ai_classifications JSONB DEFAULT '{}',
  ai_draft JSONB DEFAULT '{}',
  vendor_edits JSONB DEFAULT '{}',
  final_listing_id UUID REFERENCES public.ut_listings(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'in_progress', -- in_progress, review, published, abandoned
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ut_listing_wizard ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners manage own wizards" ON public.ut_listing_wizard
  FOR ALL TO authenticated USING (
    partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND primary_role IN ('admin','va','owner'))
  );

-- =============================================
-- 12) PARTNER ANALYTICS
-- =============================================
CREATE TABLE public.ut_partner_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  views INT DEFAULT 0,
  inquiries INT DEFAULT 0,
  bookings INT DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  avg_response_time_hours NUMERIC(5,1),
  conversion_rate NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ut_partner_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners view own analytics" ON public.ut_partner_analytics
  FOR SELECT TO authenticated USING (
    partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND primary_role IN ('admin','va','owner'))
  );

-- Indexes
CREATE INDEX idx_ut_partners_user ON public.ut_partners(user_id);
CREATE INDEX idx_ut_partners_category ON public.ut_partners(category);
CREATE INDEX idx_ut_listings_partner ON public.ut_listings(partner_id);
CREATE INDEX idx_ut_listings_status ON public.ut_listings(status);
CREATE INDEX idx_ut_listings_type ON public.ut_listings(listing_type);
CREATE INDEX idx_ut_partner_media_partner ON public.ut_partner_media(partner_id);
CREATE INDEX idx_ut_venue_spaces_partner ON public.ut_venue_spaces(partner_id);
CREATE INDEX idx_ut_rental_inventory_partner ON public.ut_rental_inventory(partner_id);
CREATE INDEX idx_ut_rental_inventory_category ON public.ut_rental_inventory(category);
CREATE INDEX idx_ut_partner_bookings_partner ON public.ut_partner_bookings(partner_id);
CREATE INDEX idx_ut_partner_bookings_date ON public.ut_partner_bookings(event_date);
CREATE INDEX idx_ut_partner_availability_date ON public.ut_partner_availability(partner_id, date);
