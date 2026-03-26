
-- ═══════════════════════════════════════════════════════
-- CATERER / BARTENDER MODULE TABLES
-- ═══════════════════════════════════════════════════════

-- Food & Beverage Profile
CREATE TABLE public.ut_partner_food_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  service_type TEXT DEFAULT 'caterer' CHECK (service_type IN ('caterer','bartender','hybrid')),
  cuisine_types TEXT[] DEFAULT '{}',
  service_styles TEXT[] DEFAULT '{}',
  dietary_capabilities TEXT[] DEFAULT '{}',
  licensing_info TEXT,
  alcohol_service_capability BOOLEAN DEFAULT false,
  alcohol_provided BOOLEAN DEFAULT false,
  outside_alcohol_allowed BOOLEAN DEFAULT false,
  staffing_model TEXT DEFAULT 'included',
  min_guest_count INT,
  max_guest_count INT,
  min_spend NUMERIC(10,2),
  service_radius INT,
  travel_fee_rules TEXT,
  setup_time_required TEXT,
  cleanup_included BOOLEAN DEFAULT true,
  tasting_available BOOLEAN DEFAULT false,
  consultation_required BOOLEAN DEFAULT false,
  consultation_fee NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partner_id)
);

-- Menus
CREATE TABLE public.ut_partner_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  menu_type TEXT DEFAULT 'general',
  description TEXT,
  price_type TEXT DEFAULT 'per_person' CHECK (price_type IN ('per_person','flat','tiered')),
  base_price NUMERIC(10,2),
  guest_range_min INT,
  guest_range_max INT,
  includes JSONB DEFAULT '[]',
  dietary_tags TEXT[] DEFAULT '{}',
  service_style TEXT,
  display_order INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Menu Items
CREATE TABLE public.ut_partner_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID REFERENCES public.ut_partner_menus(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT DEFAULT 'entree',
  description TEXT,
  dietary_tags TEXT[] DEFAULT '{}',
  spice_level INT,
  allergens TEXT[] DEFAULT '{}',
  upgrade_price NUMERIC(10,2),
  is_signature BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Service Packages (catering)
CREATE TABLE public.ut_partner_service_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  base_price NUMERIC(10,2),
  price_type TEXT DEFAULT 'per_person',
  hours_included NUMERIC(4,1),
  staffing_count INT,
  included_items JSONB DEFAULT '[]',
  optional_add_ons JSONB DEFAULT '[]',
  upgrade_paths JSONB DEFAULT '[]',
  event_type TEXT,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Food Media
CREATE TABLE public.ut_partner_food_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  menu_id UUID REFERENCES public.ut_partner_menus(id) ON DELETE SET NULL,
  media_type TEXT DEFAULT 'image',
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  caption TEXT,
  category TEXT,
  is_cover BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  quality_score INT,
  ai_tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Food Availability
CREATE TABLE public.ut_partner_food_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  available_date DATE NOT NULL,
  max_events INT DEFAULT 1,
  status TEXT DEFAULT 'available' CHECK (status IN ('available','blocked','booked','tentative')),
  note TEXT,
  peak_pricing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- DECORATOR / CREATIVE MODULE TABLES
-- ═══════════════════════════════════════════════════════

-- Creative Profile
CREATE TABLE public.ut_partner_creative_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  creative_type TEXT DEFAULT 'decorator',
  specialties TEXT[] DEFAULT '{}',
  style_tags TEXT[] DEFAULT '{}',
  event_types_supported TEXT[] DEFAULT '{}',
  service_radius INT,
  min_spend NUMERIC(10,2),
  customization_supported BOOLEAN DEFAULT true,
  setup_time_required TEXT,
  teardown_included BOOLEAN DEFAULT true,
  rush_fee_rules TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partner_id)
);

-- Collections / Themes
CREATE TABLE public.ut_partner_creative_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  theme_type TEXT,
  event_type TEXT,
  color_palette JSONB DEFAULT '[]',
  style_tags TEXT[] DEFAULT '{}',
  base_price NUMERIC(10,2),
  display_order INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Offerings / Components
CREATE TABLE public.ut_partner_creative_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  collection_id UUID REFERENCES public.ut_partner_creative_collections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'decor',
  description TEXT,
  base_price NUMERIC(10,2),
  price_type TEXT DEFAULT 'flat',
  customization_supported BOOLEAN DEFAULT true,
  material_notes TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Creative Media / Portfolio
CREATE TABLE public.ut_partner_creative_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  collection_id UUID REFERENCES public.ut_partner_creative_collections(id) ON DELETE SET NULL,
  media_type TEXT DEFAULT 'image',
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  caption TEXT,
  album TEXT,
  is_before_after BOOLEAN DEFAULT false,
  before_url TEXT,
  is_cover BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  quality_score INT,
  ai_tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Creative Packages
CREATE TABLE public.ut_partner_creative_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  package_price NUMERIC(10,2),
  included_items JSONB DEFAULT '[]',
  optional_upgrades JSONB DEFAULT '[]',
  event_type TEXT,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Custom Requests
CREATE TABLE public.ut_partner_custom_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.ut_partners(id) ON DELETE CASCADE NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  event_type TEXT,
  event_date DATE,
  description TEXT NOT NULL,
  budget_range TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new','reviewing','quoted','accepted','declined','completed')),
  quoted_price NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════
CREATE INDEX idx_ut_menus_partner ON public.ut_partner_menus(partner_id);
CREATE INDEX idx_ut_menu_items_menu ON public.ut_partner_menu_items(menu_id);
CREATE INDEX idx_ut_service_pkgs_partner ON public.ut_partner_service_packages(partner_id);
CREATE INDEX idx_ut_food_media_partner ON public.ut_partner_food_media(partner_id);
CREATE INDEX idx_ut_food_avail_partner ON public.ut_partner_food_availability(partner_id, available_date);
CREATE INDEX idx_ut_creative_collections_partner ON public.ut_partner_creative_collections(partner_id);
CREATE INDEX idx_ut_creative_offerings_partner ON public.ut_partner_creative_offerings(partner_id);
CREATE INDEX idx_ut_creative_media_partner ON public.ut_partner_creative_media(partner_id);
CREATE INDEX idx_ut_creative_pkgs_partner ON public.ut_partner_creative_packages(partner_id);
CREATE INDEX idx_ut_custom_requests_partner ON public.ut_partner_custom_requests(partner_id, status);

-- ═══════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════
ALTER TABLE public.ut_partner_food_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_service_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_food_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_food_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_creative_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_creative_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_creative_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_creative_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_creative_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_partner_custom_requests ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all, owners can write
CREATE POLICY "Authenticated read food profiles" ON public.ut_partner_food_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Partner manages food profile" ON public.ut_partner_food_profiles FOR ALL TO authenticated USING (partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated read menus" ON public.ut_partner_menus FOR SELECT TO authenticated USING (true);
CREATE POLICY "Partner manages menus" ON public.ut_partner_menus FOR ALL TO authenticated USING (partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated read menu items" ON public.ut_partner_menu_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Partner manages menu items" ON public.ut_partner_menu_items FOR ALL TO authenticated USING (menu_id IN (SELECT id FROM public.ut_partner_menus WHERE partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid())));

CREATE POLICY "Authenticated read service packages" ON public.ut_partner_service_packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Partner manages service packages" ON public.ut_partner_service_packages FOR ALL TO authenticated USING (partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated read food media" ON public.ut_partner_food_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "Partner manages food media" ON public.ut_partner_food_media FOR ALL TO authenticated USING (partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated read food availability" ON public.ut_partner_food_availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "Partner manages food availability" ON public.ut_partner_food_availability FOR ALL TO authenticated USING (partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated read creative profiles" ON public.ut_partner_creative_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Partner manages creative profile" ON public.ut_partner_creative_profiles FOR ALL TO authenticated USING (partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated read creative collections" ON public.ut_partner_creative_collections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Partner manages creative collections" ON public.ut_partner_creative_collections FOR ALL TO authenticated USING (partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated read creative offerings" ON public.ut_partner_creative_offerings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Partner manages creative offerings" ON public.ut_partner_creative_offerings FOR ALL TO authenticated USING (partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated read creative media" ON public.ut_partner_creative_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "Partner manages creative media" ON public.ut_partner_creative_media FOR ALL TO authenticated USING (partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated read creative packages" ON public.ut_partner_creative_packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Partner manages creative packages" ON public.ut_partner_creative_packages FOR ALL TO authenticated USING (partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated read custom requests" ON public.ut_partner_custom_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Partner manages custom requests" ON public.ut_partner_custom_requests FOR ALL TO authenticated USING (partner_id IN (SELECT id FROM public.ut_partners WHERE user_id = auth.uid()));
