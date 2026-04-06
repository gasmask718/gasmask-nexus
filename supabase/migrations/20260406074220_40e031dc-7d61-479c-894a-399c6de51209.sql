
-- Vehicle gift experience catalog
CREATE TABLE public.vehicle_gift_experiences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_gift_experiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active gift experiences"
  ON public.vehicle_gift_experiences FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage gift experiences"
  ON public.vehicle_gift_experiences FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Gift customization per booking
CREATE TABLE public.gift_customization (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  recipient_name TEXT,
  message_text TEXT,
  favorite_color TEXT,
  song_choice TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_customization ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage gift customization"
  ON public.gift_customization FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Gift delivery details
CREATE TABLE public.gift_delivery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  location_type TEXT NOT NULL DEFAULT 'home' CHECK (location_type IN ('home', 'dealership', 'custom')),
  address TEXT,
  delivery_time TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_delivery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage gift delivery"
  ON public.gift_delivery FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Gift add-ons junction
CREATE TABLE public.gift_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  addon_id UUID NOT NULL REFERENCES public.experience_addons(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage gift addons"
  ON public.gift_addons FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_gift_customization_booking ON public.gift_customization(booking_id);
CREATE INDEX idx_gift_delivery_booking ON public.gift_delivery(booking_id);
CREATE INDEX idx_gift_addons_booking ON public.gift_addons(booking_id);
