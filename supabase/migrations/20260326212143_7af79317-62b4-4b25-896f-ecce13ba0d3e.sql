
-- ============================================
-- CUSTOMER CONVERSION ENGINE SCHEMA
-- ============================================

-- 1) Customers table
CREATE TABLE public.ut_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  city TEXT,
  state TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ut_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ut_customers_all" ON public.ut_customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2) Event Requests table
CREATE TABLE public.ut_event_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.ut_customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  event_type TEXT NOT NULL,
  event_date DATE,
  location_city TEXT,
  location_state TEXT,
  budget_range TEXT,
  budget_min NUMERIC,
  budget_max NUMERIC,
  guest_count INTEGER,
  preferences JSONB DEFAULT '{}',
  venue_preference TEXT,
  special_requests TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  ai_recommendations JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ut_event_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ut_event_requests_all" ON public.ut_event_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3) Generated Packages table
CREATE TABLE public.ut_generated_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_request_id UUID REFERENCES public.ut_event_requests(id) ON DELETE CASCADE,
  package_name TEXT NOT NULL,
  package_type TEXT DEFAULT 'recommended',
  total_estimated_cost NUMERIC DEFAULT 0,
  total_sell_price NUMERIC DEFAULT 0,
  margin_estimate NUMERIC DEFAULT 0,
  items JSONB DEFAULT '[]',
  vendor_ids UUID[] DEFAULT '{}',
  product_ids UUID[] DEFAULT '{}',
  upgrades JSONB DEFAULT '[]',
  roi_summary JSONB DEFAULT '{}',
  recommendation_score NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ut_generated_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ut_generated_packages_all" ON public.ut_generated_packages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4) Orders table
CREATE TABLE public.ut_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.ut_customers(id) ON DELETE SET NULL,
  event_request_id UUID REFERENCES public.ut_event_requests(id) ON DELETE SET NULL,
  package_id UUID REFERENCES public.ut_generated_packages(id) ON DELETE SET NULL,
  order_number TEXT UNIQUE,
  total_price NUMERIC NOT NULL DEFAULT 0,
  deposit_amount NUMERIC DEFAULT 0,
  balance_due NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  order_status TEXT DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ut_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ut_orders_all" ON public.ut_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5) AI Recommendation RPC
CREATE OR REPLACE FUNCTION public.ut_generate_recommendations(p_event_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event ut_event_requests;
  v_vendors JSONB;
  v_products JSONB;
  v_packages JSONB;
  v_result JSONB;
BEGIN
  SELECT * INTO v_event FROM ut_event_requests WHERE id = p_event_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event request not found'; END IF;

  -- Top vendors by AI score in matching city/category
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_vendors
  FROM (
    SELECT id, business_name, category, city, state, phone, ai_score, status
    FROM ut_partner_leads
    WHERE (city ILIKE v_event.location_city OR v_event.location_city IS NULL)
      AND status NOT IN ('rejected','dead')
    ORDER BY COALESCE(ai_score, 0) DESC
    LIMIT 20
  ) t;

  -- Top products by AI score
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_products
  FROM (
    SELECT id, name, category, product_type, sell_price, ai_score, recommendation_level, is_trending
    FROM ut_products
    WHERE is_active = true
    ORDER BY COALESCE(ai_score, 0) DESC
    LIMIT 20
  ) t;

  -- Existing packages
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_packages
  FROM (
    SELECT id, name, category, base_price, description
    FROM ut_event_packages
    WHERE is_active = true
    ORDER BY base_price ASC
    LIMIT 10
  ) t;

  v_result := jsonb_build_object(
    'vendors', v_vendors,
    'products', v_products,
    'packages', v_packages,
    'event', row_to_json(v_event)
  );

  -- Store recommendations on the event
  UPDATE ut_event_requests SET ai_recommendations = v_result, updated_at = now() WHERE id = p_event_request_id;

  RETURN v_result;
END;
$$;

-- 6) Order number trigger
CREATE OR REPLACE FUNCTION public.ut_generate_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'UT-' || to_char(now(), 'YYYYMMDD') || '-' || substr(NEW.id::text, 1, 8);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ut_order_number
  BEFORE INSERT ON public.ut_orders
  FOR EACH ROW EXECUTE FUNCTION public.ut_generate_order_number();

-- Enable realtime for event requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.ut_event_requests;
