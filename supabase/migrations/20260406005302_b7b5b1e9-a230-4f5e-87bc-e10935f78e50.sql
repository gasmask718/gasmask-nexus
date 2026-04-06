
CREATE TABLE public.decor_transformations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.decor_providers(id) ON DELETE CASCADE,
  before_image TEXT,
  after_image TEXT,
  style TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_decor_transforms_provider ON public.decor_transformations(provider_id);
ALTER TABLE public.decor_transformations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage decor transformations" ON public.decor_transformations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.decor_inspirations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.decor_bookings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_decor_inspirations_booking ON public.decor_inspirations(booking_id);
ALTER TABLE public.decor_inspirations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage decor inspirations" ON public.decor_inspirations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.decor_preview_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.decor_bookings(id) ON DELETE CASCADE,
  color TEXT,
  theme TEXT,
  decor_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_decor_preview_booking ON public.decor_preview_settings(booking_id);
ALTER TABLE public.decor_preview_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage decor preview settings" ON public.decor_preview_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.decor_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.decor_bookings(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.decor_providers(id) ON DELETE CASCADE,
  match_score NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(booking_id, provider_id)
);
CREATE INDEX idx_decor_matches_booking ON public.decor_matches(booking_id);
ALTER TABLE public.decor_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth manage decor matches" ON public.decor_matches FOR ALL TO authenticated USING (true) WITH CHECK (true);
