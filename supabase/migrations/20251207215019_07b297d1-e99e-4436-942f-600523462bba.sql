
-- AI Call Sessions - real-time call state management
CREATE TABLE public.ai_call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES public.ai_call_logs(id),
  business_id UUID REFERENCES public.businesses(id),
  store_id UUID REFERENCES public.store_master(id),
  contact_id UUID,
  flow_id UUID REFERENCES public.call_flows(id),
  persona_id UUID REFERENCES public.voice_personas(id),
  current_node_id UUID REFERENCES public.call_flow_nodes(id),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'ai_active', 'human_active', 'on_hold', 'completed', 'failed')),
  handoff_state TEXT NOT NULL DEFAULT 'none' CHECK (handoff_state IN ('none', 'pending_to_human', 'human_active', 'back_to_ai')),
  assigned_agent_id UUID,
  transcript TEXT,
  ai_notes TEXT,
  call_summary TEXT,
  sentiment_trend TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Call Tone Events - track tone changes during calls
CREATE TABLE public.ai_call_tone_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ai_call_sessions(id) ON DELETE CASCADE,
  old_tone TEXT,
  new_tone TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Call Reasons - detected reasons for each call
CREATE TABLE public.call_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES public.ai_call_logs(id),
  session_id UUID REFERENCES public.ai_call_sessions(id),
  business_id UUID REFERENCES public.businesses(id),
  store_id UUID REFERENCES public.store_master(id),
  contact_id UUID,
  reason TEXT NOT NULL,
  secondary_reasons TEXT[],
  confidence INT CHECK (confidence >= 0 AND confidence <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_call_tone_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_reasons ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_call_sessions
CREATE POLICY "Users can view call sessions" ON public.ai_call_sessions
  FOR SELECT USING (true);

CREATE POLICY "Users can insert call sessions" ON public.ai_call_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update call sessions" ON public.ai_call_sessions
  FOR UPDATE USING (true);

-- RLS Policies for ai_call_tone_events
CREATE POLICY "Users can view tone events" ON public.ai_call_tone_events
  FOR SELECT USING (true);

CREATE POLICY "Users can insert tone events" ON public.ai_call_tone_events
  FOR INSERT WITH CHECK (true);

-- RLS Policies for call_reasons
CREATE POLICY "Users can view call reasons" ON public.call_reasons
  FOR SELECT USING (true);

CREATE POLICY "Users can insert call reasons" ON public.call_reasons
  FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_ai_call_sessions_status ON public.ai_call_sessions(status);
CREATE INDEX idx_ai_call_sessions_business ON public.ai_call_sessions(business_id);
CREATE INDEX idx_ai_call_sessions_handoff ON public.ai_call_sessions(handoff_state);
CREATE INDEX idx_call_reasons_session ON public.call_reasons(session_id);

-- Trigger for updated_at
CREATE TRIGGER update_ai_call_sessions_updated_at
  BEFORE UPDATE ON public.ai_call_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_call_sessions;
