
-- 1. Categories
CREATE TABLE public.experience_addon_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.experience_addon_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read categories" ON public.experience_addon_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage categories" ON public.experience_addon_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Addons
CREATE TABLE public.experience_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.experience_addon_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'flat' CHECK (type IN ('flat','hourly','package')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  provider_id UUID REFERENCES public.experience_providers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.experience_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read addons" ON public.experience_addons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage addons" ON public.experience_addons FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_experience_addons_category ON public.experience_addons(category_id);
CREATE INDEX idx_experience_addons_provider ON public.experience_addons(provider_id);

-- 3. Booking link
CREATE TABLE public.booking_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  addon_id UUID NOT NULL REFERENCES public.experience_addons(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(booking_id, addon_id)
);
ALTER TABLE public.booking_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read booking_addons" ON public.booking_addons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage booking_addons" ON public.booking_addons FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_booking_addons_booking ON public.booking_addons(booking_id);

-- Seed categories
INSERT INTO public.experience_addon_categories (name, display_order) VALUES
  ('Photography', 1),
  ('Entertainment', 2),
  ('Decor', 3),
  ('VIP', 4),
  ('Vehicle', 5);
