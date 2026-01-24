-- ============================================
-- CALL STATE AUTHORITY ENGINE
-- Single Source of Truth for Call State
-- ============================================

-- Create canonical call states enum
CREATE TYPE public.call_state AS ENUM (
  'ringing',
  'ai_listening',
  'ai_speaking', 
  'handoff_pending',
  'human_active',
  'ai_muted',
  'escalated',
  'ended'
);

-- Create call state machine table - THE authoritative state
CREATE TABLE public.call_state_machine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ai_call_sessions(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id),
  current_state public.call_state NOT NULL DEFAULT 'ringing',
  previous_state public.call_state,
  ai_speech_allowed BOOLEAN NOT NULL DEFAULT false,
  human_speech_active BOOLEAN NOT NULL DEFAULT false,
  state_locked_by TEXT, -- 'kill_switch', 'confidence_breach', 'audit_failure', 'human_takeover'
  lock_reason TEXT,
  active_speaker TEXT, -- 'ai', 'human', 'caller', 'none'
  confidence_at_state NUMERIC(5,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id)
);

-- Create state transition log - event-sourced history
CREATE TABLE public.call_state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ai_call_sessions(id) ON DELETE CASCADE,
  business_id UUID NOT NULL,
  from_state public.call_state,
  to_state public.call_state NOT NULL,
  transition_trigger TEXT NOT NULL, -- 'call_answered', 'ai_started_speaking', 'confidence_breach', 'operator_takeover', 'kill_switch', 'call_ended', etc.
  triggered_by TEXT, -- 'system', 'operator', 'ai', 'caller', user_id
  trigger_details JSONB DEFAULT '{}',
  ai_was_speaking BOOLEAN DEFAULT false,
  speech_interrupted BOOLEAN DEFAULT false,
  confidence_at_transition NUMERIC(5,4),
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Hash chain for immutability
  prev_hash TEXT,
  row_hash TEXT
);

-- Create state transition rules table (configuration)
CREATE TABLE public.call_state_transition_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_state public.call_state NOT NULL,
  to_state public.call_state NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  requires_condition TEXT, -- 'callable_human_available', 'ai_speech_enabled', 'confidence_above_threshold', etc.
  blocks_ai_speech BOOLEAN DEFAULT false,
  requires_human BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(from_state, to_state)
);

-- Insert canonical state transition rules
INSERT INTO public.call_state_transition_rules (from_state, to_state, allowed, requires_condition, blocks_ai_speech, requires_human, description) VALUES
-- From ringing
('ringing', 'ai_listening', true, 'ai_speech_enabled', false, false, 'AI picks up call'),
('ringing', 'human_active', true, 'callable_human_available', true, true, 'Human answers directly'),
('ringing', 'ended', true, NULL, true, false, 'Call ends unanswered'),

-- From ai_listening
('ai_listening', 'ai_speaking', true, 'ai_speech_allowed', false, false, 'AI starts speaking'),
('ai_listening', 'handoff_pending', true, NULL, true, false, 'AI requests handoff'),
('ai_listening', 'human_active', true, 'callable_human_available', true, true, 'Operator takes over'),
('ai_listening', 'ai_muted', true, NULL, true, false, 'AI muted by trigger'),
('ai_listening', 'escalated', true, NULL, true, false, 'Call escalated'),
('ai_listening', 'ended', true, NULL, true, false, 'Call ends'),

-- From ai_speaking
('ai_speaking', 'ai_listening', true, NULL, false, false, 'AI finishes speaking, returns to listening'),
('ai_speaking', 'handoff_pending', true, NULL, true, false, 'AI requests handoff mid-speech'),
('ai_speaking', 'human_active', true, 'callable_human_available', true, true, 'Operator interrupts AI'),
('ai_speaking', 'ai_muted', true, NULL, true, false, 'AI muted immediately'),
('ai_speaking', 'escalated', true, NULL, true, false, 'Emergency escalation'),
('ai_speaking', 'ended', true, NULL, true, false, 'Call ends'),

-- From handoff_pending
('handoff_pending', 'human_active', true, 'callable_human_available', true, true, 'Human accepts handoff'),
('handoff_pending', 'ai_listening', true, 'ai_speech_enabled', false, false, 'Handoff canceled, AI resumes'),
('handoff_pending', 'escalated', true, NULL, true, false, 'No human available, escalate'),
('handoff_pending', 'ended', true, NULL, true, false, 'Call ends during handoff'),

-- From human_active (AI CANNOT SPEAK)
('human_active', 'ai_muted', true, NULL, true, false, 'Human explicitly mutes AI'),
('human_active', 'ended', true, NULL, true, false, 'Call ends'),
-- NOTE: No transition from human_active to ai_speaking - AI is locked out

-- From ai_muted (AI CANNOT SPEAK)
('ai_muted', 'human_active', true, 'callable_human_available', true, true, 'Human takes over'),
('ai_muted', 'ai_listening', true, 'unmute_authorized', false, false, 'AI unmuted by operator'),
('ai_muted', 'escalated', true, NULL, true, false, 'Escalate from muted state'),
('ai_muted', 'ended', true, NULL, true, false, 'Call ends'),

-- From escalated (terminal or near-terminal)
('escalated', 'human_active', true, 'callable_human_available', true, true, 'Human handles escalation'),
('escalated', 'ended', true, NULL, true, false, 'Call ends after escalation'),

-- From ended (terminal - no transitions out)
('ended', 'ended', false, NULL, true, false, 'Cannot transition from ended');

-- Create indexes for performance
CREATE INDEX idx_call_state_machine_session ON public.call_state_machine(session_id);
CREATE INDEX idx_call_state_machine_business ON public.call_state_machine(business_id);
CREATE INDEX idx_call_state_machine_current_state ON public.call_state_machine(current_state);
CREATE INDEX idx_call_state_transitions_session ON public.call_state_transitions(session_id);
CREATE INDEX idx_call_state_transitions_created ON public.call_state_transitions(created_at DESC);

-- Enable RLS
ALTER TABLE public.call_state_machine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_state_transition_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Service role full access to call_state_machine" 
  ON public.call_state_machine FOR ALL 
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to call_state_transitions" 
  ON public.call_state_transitions FOR ALL 
  USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can read transition rules" 
  ON public.call_state_transition_rules FOR SELECT 
  USING (true);

-- Enable realtime for operator UI
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_state_machine;

-- Trigger to compute hash chain for transitions
CREATE OR REPLACE FUNCTION public.compute_state_transition_hash()
RETURNS TRIGGER AS $$
DECLARE
  v_prev_hash TEXT;
  v_canonical TEXT;
BEGIN
  -- Get previous hash
  SELECT row_hash INTO v_prev_hash
  FROM public.call_state_transitions
  WHERE session_id = NEW.session_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  NEW.prev_hash := COALESCE(v_prev_hash, 'GENESIS');
  
  -- Build canonical string
  v_canonical := COALESCE(NEW.prev_hash, '') || '|' ||
                 COALESCE(NEW.session_id::text, '') || '|' ||
                 COALESCE(NEW.from_state::text, 'NULL') || '|' ||
                 COALESCE(NEW.to_state::text, '') || '|' ||
                 COALESCE(NEW.transition_trigger, '') || '|' ||
                 COALESCE(NEW.created_at::text, '');
  
  NEW.row_hash := encode(extensions.digest(v_canonical, 'sha256'), 'hex');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE TRIGGER trg_state_transition_hash
  BEFORE INSERT ON public.call_state_transitions
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_state_transition_hash();

-- Trigger to update call_state_machine updated_at
CREATE OR REPLACE FUNCTION public.update_call_state_machine_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_call_state_machine_updated
  BEFORE UPDATE ON public.call_state_machine
  FOR EACH ROW
  EXECUTE FUNCTION public.update_call_state_machine_timestamp();