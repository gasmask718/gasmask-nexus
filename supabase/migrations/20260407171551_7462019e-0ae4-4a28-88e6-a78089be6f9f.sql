
-- 1. Suppliers first (referenced by rentals + staff)
CREATE TABLE public.event_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_email TEXT,
  phone TEXT,
  city TEXT,
  state TEXT,
  type TEXT,
  rating NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Rentals
CREATE TABLE public.event_rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  price NUMERIC DEFAULT 0,
  price_type TEXT DEFAULT 'flat',
  image_url TEXT,
  supplier_id UUID REFERENCES public.event_suppliers(id) ON DELETE SET NULL,
  inventory_count INT DEFAULT 0,
  city TEXT,
  state TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Staff
CREATE TABLE public.event_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  hourly_rate NUMERIC DEFAULT 0,
  rating NUMERIC DEFAULT 0,
  profile_image TEXT,
  availability_status TEXT DEFAULT 'available',
  city TEXT,
  state TEXT,
  supplier_id UUID REFERENCES public.event_suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Cart
CREATE TABLE public.event_cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  total_price NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Cart Items
CREATE TABLE public.event_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES public.event_cart(id) ON DELETE CASCADE NOT NULL,
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  quantity INT DEFAULT 1,
  hours INT,
  price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.event_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view suppliers" ON public.event_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can manage suppliers" ON public.event_suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth can view rentals" ON public.event_rentals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can manage rentals" ON public.event_rentals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth can view staff" ON public.event_staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can manage staff" ON public.event_staff FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users own cart" ON public.event_cart FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own cart items" ON public.event_cart_items FOR ALL TO authenticated
  USING (cart_id IN (SELECT id FROM public.event_cart WHERE user_id = auth.uid()))
  WITH CHECK (cart_id IN (SELECT id FROM public.event_cart WHERE user_id = auth.uid()));

CREATE INDEX idx_event_rentals_city ON public.event_rentals(city);
CREATE INDEX idx_event_staff_city ON public.event_staff(city);
CREATE INDEX idx_event_suppliers_city ON public.event_suppliers(city);
CREATE INDEX idx_event_cart_user ON public.event_cart(user_id);
CREATE INDEX idx_event_cart_items_cart ON public.event_cart_items(cart_id);
