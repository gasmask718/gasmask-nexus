
-- Event Space Partners (supplier pipeline)
CREATE TABLE public.event_space_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  city TEXT,
  state TEXT,
  website TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended')),
  commission_rate NUMERIC(5,2) DEFAULT 15.00,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event Spaces (main inventory)
CREATE TABLE public.event_spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.event_space_partners(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  capacity INT,
  category TEXT NOT NULL DEFAULT 'hall' CHECK (category IN ('rooftop','hall','lounge','outdoor','ballroom','garden','warehouse')),
  base_price NUMERIC(10,2),
  commission_rate NUMERIC(5,2) DEFAULT 15.00,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event Space Images
CREATE TABLE public.event_space_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_space_id UUID NOT NULL REFERENCES public.event_spaces(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Event Space Availability
CREATE TABLE public.event_space_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_space_id UUID NOT NULL REFERENCES public.event_spaces(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_space_id, date)
);

-- Event Space Features
CREATE TABLE public.event_space_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_space_id UUID NOT NULL REFERENCES public.event_spaces(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.event_space_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_space_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_space_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_space_features ENABLE ROW LEVEL SECURITY;

-- Partners: anon can insert (public form), authenticated can read
CREATE POLICY "Anyone can submit venue partner application"
  ON public.event_space_partners FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Authenticated can view partners"
  ON public.event_space_partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manages partners"
  ON public.event_space_partners FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can update partners"
  ON public.event_space_partners FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Spaces: authenticated can read, service_role manages
CREATE POLICY "Authenticated can view spaces"
  ON public.event_spaces FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manages spaces"
  ON public.event_spaces FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can insert spaces"
  ON public.event_spaces FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update spaces"
  ON public.event_spaces FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete spaces"
  ON public.event_spaces FOR DELETE TO authenticated USING (true);

-- Images
CREATE POLICY "Authenticated can view images"
  ON public.event_space_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage images"
  ON public.event_space_images FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Availability
CREATE POLICY "Authenticated can view availability"
  ON public.event_space_availability FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage availability"
  ON public.event_space_availability FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Features
CREATE POLICY "Authenticated can view features"
  ON public.event_space_features FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage features"
  ON public.event_space_features FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated_at triggers
CREATE TRIGGER update_event_space_partners_updated_at
  BEFORE UPDATE ON public.event_space_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_spaces_updated_at
  BEFORE UPDATE ON public.event_spaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_event_spaces_city_state ON public.event_spaces(city, state);
CREATE INDEX idx_event_spaces_category ON public.event_spaces(category);
CREATE INDEX idx_event_spaces_partner ON public.event_spaces(partner_id);
CREATE INDEX idx_event_space_availability_date ON public.event_space_availability(event_space_id, date);
