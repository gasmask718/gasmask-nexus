
CREATE TABLE public.experience_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT,
  media JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT '{}',
  rating NUMERIC(3,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exp_providers_category ON public.experience_providers(category);
CREATE INDEX idx_exp_providers_city ON public.experience_providers(city);

ALTER TABLE public.experience_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage experience providers"
  ON public.experience_providers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Link providers to corporate event requests
CREATE TABLE public.corporate_event_provider_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.corporate_event_requests(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.experience_providers(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_provider_links_request ON public.corporate_event_provider_links(request_id);

ALTER TABLE public.corporate_event_provider_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage provider links"
  ON public.corporate_event_provider_links FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
