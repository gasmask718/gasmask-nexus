
CREATE TABLE IF NOT EXISTS ut_brand_kits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name TEXT DEFAULT 'Unforgettable Times',
  version TEXT DEFAULT 'v1',
  logo_png_url TEXT,
  logo_svg_url TEXT,
  logo_ai_url TEXT,
  primary_color_hex TEXT DEFAULT '#7C3AED',
  secondary_color_hex TEXT DEFAULT '#EC4899',
  accent_color_hex TEXT DEFAULT '#F59E0B',
  pantone_primary TEXT,
  pantone_secondary TEXT,
  primary_font TEXT DEFAULT 'Montserrat Bold',
  secondary_font TEXT DEFAULT 'Open Sans',
  packaging_template_url TEXT,
  insert_template_url TEXT,
  sticker_template_url TEXT,
  thank_you_card_url TEXT,
  qr_code_customer_url TEXT,
  qr_code_supplier_url TEXT,
  qr_code_ambassador_url TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ut_suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  platform TEXT,
  platform_url TEXT,
  product_categories TEXT[],
  supports_private_label BOOLEAN DEFAULT FALSE,
  logo_methods TEXT[],
  custom_moq INTEGER,
  branding_cost_per_unit DECIMAL,
  sample_available BOOLEAN DEFAULT FALSE,
  sample_cost DECIMAL,
  white_label_available BOOLEAN DEFAULT FALSE,
  production_time_days INTEGER,
  shipping_time_days INTEGER,
  cost_score INTEGER,
  speed_score INTEGER,
  reliability_score INTEGER,
  status TEXT DEFAULT 'contacted',
  preferred BOOLEAN DEFAULT FALSE,
  notes TEXT,
  brand_kit_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ut_branding_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES ut_suppliers(id),
  product_name TEXT NOT NULL,
  product_category TEXT,
  logo_placement TEXT,
  packaging_type TEXT,
  insert_type TEXT,
  white_label_requested BOOLEAN DEFAULT FALSE,
  sample_required BOOLEAN DEFAULT TRUE,
  sample_status TEXT DEFAULT 'pending',
  approved_mockup_url TEXT,
  rejection_notes TEXT,
  branding_fee DECIMAL,
  production_delay_days INTEGER,
  moq INTEGER,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ut_quiz_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT,
  phone TEXT,
  business_type TEXT,
  budget_range TEXT,
  wants_branding TEXT,
  supply_preference TEXT,
  needs_training TEXT,
  launch_timeline TEXT,
  recommended_kit TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ut_business_consultations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  best_time TEXT,
  kit_interest TEXT,
  budget TEXT,
  location TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ut_kit_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  kit_name TEXT NOT NULL,
  branding_tier TEXT DEFAULT 'none',
  branding_notes TEXT,
  total_paid DECIMAL,
  status TEXT DEFAULT 'pending',
  tracking_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ut_brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ut_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ut_branding_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ut_quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ut_business_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ut_kit_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth all ut_brand_kits" ON ut_brand_kits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth all ut_suppliers" ON ut_suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth all ut_branding_requests" ON ut_branding_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth all ut_quiz_results" ON ut_quiz_results FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth all ut_business_consultations" ON ut_business_consultations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth all ut_kit_orders" ON ut_kit_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
