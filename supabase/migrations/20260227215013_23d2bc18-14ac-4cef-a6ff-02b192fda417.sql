
-- Live calls table for real-time call state tracking
CREATE TABLE public.live_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_sid TEXT UNIQUE,
  business_id UUID REFERENCES public.businesses(id),
  store_id UUID REFERENCES public.store_master(id),
  phone_number TEXT,
  agent_type TEXT NOT NULL DEFAULT 'ai' CHECK (agent_type IN ('ai', 'human', 'hybrid')),
  voice_provider TEXT,
  state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'dialing', 'ringing', 'answered', 'ai_active', 'human_connected', 'completed', 'failed')),
  entity_name TEXT,
  run_id UUID,
  source_reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  recording_url TEXT,
  recording_sid TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_calls_state ON public.live_calls(state);
CREATE INDEX idx_live_calls_business ON public.live_calls(business_id);
CREATE INDEX idx_live_calls_call_sid ON public.live_calls(call_sid);

-- Live call transcripts for streaming AI conversation
CREATE TABLE public.live_call_transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_sid TEXT NOT NULL,
  live_call_id UUID REFERENCES public.live_calls(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL CHECK (speaker IN ('ai', 'human', 'caller', 'system')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_transcripts_call ON public.live_call_transcripts(live_call_id);
CREATE INDEX idx_live_transcripts_sid ON public.live_call_transcripts(call_sid);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_call_transcripts;

-- RLS
ALTER TABLE public.live_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_call_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view live_calls" ON public.live_calls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert live_calls" ON public.live_calls FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update live_calls" ON public.live_calls FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view live_call_transcripts" ON public.live_call_transcripts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert live_call_transcripts" ON public.live_call_transcripts FOR INSERT TO authenticated WITH CHECK (true);

-- Service role policies for edge functions
CREATE POLICY "Service role full access live_calls" ON public.live_calls FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access live_call_transcripts" ON public.live_call_transcripts FOR ALL TO service_role USING (true);
