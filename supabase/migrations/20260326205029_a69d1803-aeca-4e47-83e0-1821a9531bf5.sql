
-- =============================================
-- PHASE 4 & 5: PRODUCT DUAL-ENGINE + SUPPLIERS
-- =============================================

-- Product type enum
CREATE TYPE public.ut_product_type AS ENUM ('gift', 'business_asset');

-- Fulfillment model enum  
CREATE TYPE public.ut_fulfillment_model AS ENUM ('dropship', 'wholesale', 'direct_manufacturer', 'curated_seller', 'platform_owned');

-- Suppliers table
CREATE TABLE public.ut_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  website text,
  source_platform text, -- alibaba, wholesale, direct, independent
  fulfillment_model public.ut_fulfillment_model NOT NULL DEFAULT 'dropship',
  shipping_speed_days integer,
  shipping_zones text[], -- us_domestic, international, etc.
  min_order_qty integer,
  quality_rating numeric(3,1) DEFAULT 0,
  reliability_score numeric(3,1) DEFAULT 0,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ut_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view suppliers" ON public.ut_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage suppliers" ON public.ut_suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Products table (dual engine: gift vs business_asset)
CREATE TABLE public.ut_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  product_type public.ut_product_type NOT NULL,
  category text NOT NULL, -- birthday_gift, led_sign, 360_booth, tent, etc.
  subcategory text,
  supplier_id uuid REFERENCES public.ut_suppliers(id),
  
  -- Pricing
  landed_cost numeric(10,2),
  sell_price numeric(10,2),
  margin_pct numeric(5,2),
  
  -- Fulfillment
  fulfillment_model public.ut_fulfillment_model DEFAULT 'dropship',
  shipping_speed_days integer,
  shipping_cost numeric(8,2),
  moq integer DEFAULT 1,
  
  -- Intelligence scores
  trend_score numeric(3,1) DEFAULT 0, -- 0-10
  conversion_score numeric(3,1) DEFAULT 0,
  visual_appeal_score numeric(3,1) DEFAULT 0,
  event_relevance_score numeric(3,1) DEFAULT 0,
  overall_score numeric(3,1) DEFAULT 0,
  
  -- Metadata
  image_urls text[],
  tags text[],
  is_featured boolean DEFAULT false,
  is_active boolean DEFAULT true,
  
  -- ROI data (for business_asset products)
  estimated_roi_pct numeric(5,1),
  startup_guide_url text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ut_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view products" ON public.ut_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage products" ON public.ut_products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Product categories for intelligence
CREATE TABLE public.ut_product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  label text NOT NULL,
  product_type public.ut_product_type NOT NULL,
  parent_slug text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true
);

ALTER TABLE public.ut_product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view product categories" ON public.ut_product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage categories" ON public.ut_product_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed core product categories
INSERT INTO public.ut_product_categories (slug, label, product_type, sort_order) VALUES
  -- Gift categories
  ('birthday_gift', 'Birthday Gifts', 'gift', 1),
  ('personalized_favor', 'Personalized Favors', 'gift', 2),
  ('led_sign', 'LED Signs & Neon', 'gift', 3),
  ('balloon_kit', 'Balloon Kits', 'gift', 4),
  ('cake_topper', 'Cake Toppers', 'gift', 5),
  ('themed_decor', 'Themed Decorations', 'gift', 6),
  ('party_supply', 'Party Supplies', 'gift', 7),
  ('impulse_upsell', 'Impulse Add-Ons', 'gift', 8),
  -- Business asset categories
  ('360_booth', '360 Photo Booth', 'business_asset', 10),
  ('tent', 'Tents & Canopies', 'business_asset', 11),
  ('chair', 'Chairs', 'business_asset', 12),
  ('table', 'Tables', 'business_asset', 13),
  ('bounce_house', 'Bounce Houses', 'business_asset', 14),
  ('inflatable', 'Inflatables', 'business_asset', 15),
  ('lighting', 'Lighting Equipment', 'business_asset', 16),
  ('speaker', 'Sound & Speakers', 'business_asset', 17),
  ('decor_framework', 'Decor Frameworks', 'business_asset', 18),
  ('rental_misc', 'Other Rental Assets', 'business_asset', 19);
