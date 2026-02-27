
CREATE TABLE public.voice_cost_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'elevenlabs',
  characters_generated INTEGER NOT NULL DEFAULT 0,
  estimated_cost NUMERIC(10,6) DEFAULT 0,
  session_id UUID REFERENCES public.ai_call_sessions(id),
  persona_id UUID REFERENCES public.voice_personas(id),
  business_id UUID REFERENCES public.businesses(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_cost_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read voice cost events"
  ON public.voice_cost_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert voice cost events"
  ON public.voice_cost_events FOR INSERT
  TO authenticated
  WITH CHECK (true);
