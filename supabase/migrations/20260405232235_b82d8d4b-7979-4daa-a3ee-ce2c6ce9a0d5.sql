
CREATE TABLE public.corporate_event_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.corporate_event_requests(id) ON DELETE CASCADE,
  hotel_id UUID REFERENCES public.tt_hotels(id) ON DELETE SET NULL,
  nightlife_id UUID REFERENCES public.nightlife_requests(id) ON DELETE SET NULL,
  chauffeur_id UUID,
  addons JSONB DEFAULT '[]'::jsonb,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_corp_bundles_request ON public.corporate_event_bundles(request_id);

ALTER TABLE public.corporate_event_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage bundles"
  ON public.corporate_event_bundles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
