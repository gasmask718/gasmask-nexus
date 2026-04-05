
-- Corporate Event Venues
CREATE TABLE public.corporate_event_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier TEXT DEFAULT 'mock',
  supplier_venue_id TEXT,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  neighborhood TEXT,
  address TEXT,
  description TEXT,
  capacity INTEGER,
  style_tags TEXT[] DEFAULT '{}',
  amenities TEXT[] DEFAULT '{}',
  hero_image TEXT,
  gallery TEXT[] DEFAULT '{}',
  starting_rate NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Corporate Event Staff Roles
CREATE TABLE public.corporate_event_staff_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier TEXT DEFAULT 'mock',
  supplier_role_id TEXT,
  role_name TEXT NOT NULL,
  description TEXT,
  rate_type TEXT DEFAULT 'hourly' CHECK (rate_type IN ('hourly','event','daily')),
  rate_amount NUMERIC(10,2) DEFAULT 0,
  city TEXT,
  tags TEXT[] DEFAULT '{}',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Corporate Event Rentals
CREATE TABLE public.corporate_event_rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier TEXT DEFAULT 'mock',
  supplier_rental_id TEXT,
  item_name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  image_url TEXT,
  rental_rate NUMERIC(10,2) DEFAULT 0,
  unit_type TEXT DEFAULT 'per_event',
  inventory_count INTEGER DEFAULT 1,
  city TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Corporate Event Requests
CREATE TABLE public.corporate_event_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  city TEXT,
  event_type TEXT,
  guest_count INTEGER,
  event_date DATE,
  budget_range TEXT,
  notes TEXT,
  assigned_planner TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','proposal_sent','approved','booked','cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Corporate Event Request Items (line items)
CREATE TABLE public.corporate_event_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.corporate_event_requests(id) ON DELETE CASCADE NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('venue','staff','rental')),
  item_id UUID NOT NULL,
  quantity INTEGER DEFAULT 1,
  selected_rate NUMERIC(10,2) DEFAULT 0,
  subtotal NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Corporate Event Proposals
CREATE TABLE public.corporate_event_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.corporate_event_requests(id) ON DELETE CASCADE NOT NULL,
  subtotal NUMERIC(10,2) DEFAULT 0,
  fees NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','approved','declined')),
  created_by TEXT,
  sent_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.corporate_event_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_event_staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_event_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_event_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_event_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_event_proposals ENABLE ROW LEVEL SECURITY;

-- Public read for catalog tables
CREATE POLICY "Public read venues" ON public.corporate_event_venues FOR SELECT USING (true);
CREATE POLICY "Public read staff" ON public.corporate_event_staff_roles FOR SELECT USING (true);
CREATE POLICY "Public read rentals" ON public.corporate_event_rentals FOR SELECT USING (true);

-- Authenticated full access for admin
CREATE POLICY "Auth manage venues" ON public.corporate_event_venues FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth manage staff" ON public.corporate_event_staff_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth manage rentals" ON public.corporate_event_rentals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth manage requests" ON public.corporate_event_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth manage request items" ON public.corporate_event_request_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth manage proposals" ON public.corporate_event_proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anon can submit requests
CREATE POLICY "Anon submit requests" ON public.corporate_event_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon read own requests" ON public.corporate_event_requests FOR SELECT TO anon USING (true);

-- Indexes
CREATE INDEX idx_corp_venues_city ON public.corporate_event_venues(city);
CREATE INDEX idx_corp_staff_city ON public.corporate_event_staff_roles(city);
CREATE INDEX idx_corp_rentals_category ON public.corporate_event_rentals(category);
CREATE INDEX idx_corp_requests_status ON public.corporate_event_requests(status);
CREATE INDEX idx_corp_req_items_request ON public.corporate_event_request_items(request_id);
CREATE INDEX idx_corp_proposals_request ON public.corporate_event_proposals(request_id);

-- Realtime for requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.corporate_event_requests;

-- Seed mock venues
INSERT INTO public.corporate_event_venues (name, city, neighborhood, address, description, capacity, style_tags, amenities, starting_rate, hero_image) VALUES
('The Grand Ballroom NYC', 'New York', 'Midtown', '450 W 37th St', 'Elegant 10,000 sq ft ballroom with panoramic city views', 500, ARRAY['elegant','modern','corporate'], ARRAY['AV System','Stage','Catering Kitchen','Valet Parking'], 15000, 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800'),
('Skyline Loft Brooklyn', 'New York', 'DUMBO', '205 Water St', 'Industrial-chic loft with Manhattan skyline backdrop', 250, ARRAY['industrial','loft','trendy'], ARRAY['Rooftop Access','Built-in Bar','WiFi','Projector'], 8500, 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800'),
('Miami Convention Pavilion', 'Miami', 'Downtown', '1901 Convention Center Dr', 'Sun-drenched waterfront venue for large-scale corporate events', 800, ARRAY['waterfront','luxury','spacious'], ARRAY['Ocean View','Full Kitchen','Loading Dock','Green Room'], 22000, 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800'),
('Atlanta Tech Hub', 'Atlanta', 'Buckhead', '3500 Lenox Rd NE', 'Modern tech-forward venue with built-in presentation infrastructure', 300, ARRAY['tech','modern','corporate'], ARRAY['LED Wall','Fiber Internet','Breakout Rooms','Coffee Bar'], 10000, 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800');

-- Seed mock staff roles
INSERT INTO public.corporate_event_staff_roles (role_name, description, rate_type, rate_amount, city, tags) VALUES
('Event Manager', 'Senior on-site coordinator for corporate events', 'event', 1500, 'New York', ARRAY['management','coordination']),
('AV Technician', 'Audio/visual setup and live support', 'hourly', 75, 'New York', ARRAY['technical','av']),
('Bartender', 'Professional mixologist for corporate receptions', 'hourly', 45, 'New York', ARRAY['service','beverage']),
('Security Officer', 'Licensed event security personnel', 'hourly', 55, 'New York', ARRAY['security','licensed']),
('Catering Server', 'Professional food service staff', 'hourly', 35, 'New York', ARRAY['service','food']),
('Photographer', 'Professional corporate event photography', 'event', 2000, 'New York', ARRAY['media','photography']);

-- Seed mock rentals
INSERT INTO public.corporate_event_rentals (item_name, category, description, rental_rate, unit_type, inventory_count, city) VALUES
('Round Table (60")', 'Furniture', 'Seats 8-10 guests', 35, 'per_unit', 50, 'New York'),
('Chiavari Chair - Gold', 'Furniture', 'Elegant gold chiavari with cushion', 8, 'per_unit', 300, 'New York'),
('LED Stage Lighting Package', 'Lighting', '12-fixture intelligent lighting rig', 1200, 'per_event', 5, 'New York'),
('Wireless Microphone System', 'AV', '4-channel wireless mic system', 250, 'per_event', 10, 'New York'),
('Projector + Screen (120")', 'AV', 'HD projector with motorized screen', 400, 'per_event', 8, 'New York'),
('Pipe & Drape (per 10ft section)', 'Decor', 'White or black draping', 45, 'per_unit', 100, 'New York'),
('Red Carpet Runner (25ft)', 'Decor', 'Premium red carpet entrance', 150, 'per_event', 10, 'New York'),
('Portable Bar Station', 'Furniture', 'Full-service portable bar with LED accents', 350, 'per_event', 6, 'New York');
