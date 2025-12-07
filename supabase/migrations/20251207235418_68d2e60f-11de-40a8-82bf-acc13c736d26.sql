
-- V8: Real-Time Multi-Agent Voice Orchestration + AI Switchboard Operator

-- 1. Create CallParticipants table for multi-party voice sessions
CREATE TABLE public.call_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.ai_call_sessions(id) ON DELETE CASCADE,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('ai_agent', 'human_agent', 'store_contact', 'driver', 'biker', 'other')),
  agent_id UUID REFERENCES public.ai_agents(id),
  user_id UUID REFERENCES auth.users(id),
  contact_id UUID,
  role TEXT NOT NULL DEFAULT 'listener' CHECK (role IN ('speaker', 'listener', 'whisper_only')),
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE
);

-- 2. Extend ai_call_sessions with multi-party fields
ALTER TABLE public.ai_call_sessions 
ADD COLUMN IF NOT EXISTS primary_agent_id UUID REFERENCES public.ai_agents(id),
ADD COLUMN IF NOT EXISTS switchboard_agent_id UUID REFERENCES public.ai_agents(id),
ADD COLUMN IF NOT EXISTS is_multi_party BOOLEAN DEFAULT false;

-- 3. Create ActiveSpeakerLog table
CREATE TABLE public.active_speaker_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.ai_call_sessions(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.ai_agents(id),
  participant_id UUID REFERENCES public.call_participants(id),
  participant_type TEXT NOT NULL CHECK (participant_type IN ('ai_agent', 'human_agent', 'store_contact', 'driver', 'biker')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- 4. Create WhisperCoachingEvents table
CREATE TABLE public.whisper_coaching_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.ai_call_sessions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id),
  human_participant_id UUID NOT NULL REFERENCES public.call_participants(id),
  suggestion TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Create CallRoutingRules table
CREATE TABLE public.call_routing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  name TEXT NOT NULL,
  description TEXT,
  condition JSONB NOT NULL DEFAULT '{}',
  action JSONB NOT NULL DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Enable RLS on new tables
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_speaker_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whisper_coaching_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_routing_rules ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies
CREATE POLICY "Allow all access to call_participants" ON public.call_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to active_speaker_log" ON public.active_speaker_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to whisper_coaching_events" ON public.whisper_coaching_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to call_routing_rules" ON public.call_routing_rules FOR ALL USING (true) WITH CHECK (true);

-- 8. Create indexes
CREATE INDEX idx_call_participants_session ON public.call_participants(session_id);
CREATE INDEX idx_call_participants_agent ON public.call_participants(agent_id);
CREATE INDEX idx_active_speaker_session ON public.active_speaker_log(session_id);
CREATE INDEX idx_whisper_session ON public.whisper_coaching_events(session_id);
CREATE INDEX idx_routing_rules_business ON public.call_routing_rules(business_id);

-- 9. Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_speaker_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whisper_coaching_events;
