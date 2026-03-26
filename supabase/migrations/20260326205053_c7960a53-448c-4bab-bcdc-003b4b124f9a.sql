
-- =============================================
-- PHASE 7: PACKAGE COMPOSITION ENGINE
-- =============================================

CREATE TABLE public.ut_event_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  package_type text NOT NULL, -- corporate, birthday, wedding, premium, luxury, startup_bundle
  
  -- Pricing
  base_price numeric(10,2),
  premium_price numeric(10,2),
  
  -- Composition metadata
  included_categories text[], -- venue, catering, entertainment, transport, etc.
  
  -- Intelligence
  popularity_score numeric(3,1) DEFAULT 0,
  margin_pct numeric(5,2),
  is_featured boolean DEFAULT false,
  is_active boolean DEFAULT true,
  
  -- TopTier integration flag
  includes_transport boolean DEFAULT false,
  toptier_vehicle_class text, -- sedan, suv, limo, party_bus
  
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ut_event_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view packages" ON public.ut_event_packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage packages" ON public.ut_event_packages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Package line items (links to partners, products, or transport)
CREATE TABLE public.ut_package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid REFERENCES public.ut_event_packages(id) ON DELETE CASCADE NOT NULL,
  item_type text NOT NULL, -- service_partner, product, transport
  
  -- Polymorphic reference
  partner_profile_id uuid REFERENCES public.ut_partner_profiles(id),
  product_id uuid REFERENCES public.ut_products(id),
  
  -- Item details
  label text NOT NULL,
  category text,
  unit_price numeric(10,2),
  quantity integer DEFAULT 1,
  is_optional boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ut_package_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view package items" ON public.ut_package_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage package items" ON public.ut_package_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service supply graph enhancement: add platform_score and package_eligible to partner profiles
ALTER TABLE public.ut_partner_profiles
  ADD COLUMN IF NOT EXISTS platform_score numeric(3,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS package_eligible boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_coverage text[],
  ADD COLUMN IF NOT EXISTS service_categories text[];
