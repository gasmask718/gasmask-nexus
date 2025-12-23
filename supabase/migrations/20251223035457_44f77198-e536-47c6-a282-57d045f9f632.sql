
-- Conversation Memory v3: Outcome Simulation Engine
-- Simulates multiple future conversation paths before action

-- Outcome Simulations table
CREATE TABLE public.outcome_simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversation_memories(id) ON DELETE CASCADE,
  triggering_context JSONB DEFAULT '{}',
  triggering_type TEXT DEFAULT 'manual', -- manual, event, intent_change, scheduled
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recommended_scenario_id UUID,
  confidence_index NUMERIC(5,2) DEFAULT 0,
  expiry_timestamp TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
  status TEXT DEFAULT 'active', -- active, expired, executed, dismissed
  human_override_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Simulation Scenarios table
CREATE TABLE public.simulation_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulation_id UUID NOT NULL REFERENCES public.outcome_simulations(id) ON DELETE CASCADE,
  scenario_name TEXT NOT NULL,
  scenario_rank INTEGER DEFAULT 1,
  initiating_action_type TEXT NOT NULL, -- call, text, email, silence, escalation
  tone_profile TEXT DEFAULT 'neutral', -- friendly, firm, reassuring, direct, de-escalating
  predicted_contact_response TEXT,
  predicted_intent_shift JSONB DEFAULT '{}',
  predicted_sentiment_shift TEXT, -- positive, neutral, negative
  predicted_outcomes JSONB DEFAULT '[]',
  risk_score NUMERIC(5,2) DEFAULT 0,
  opportunity_score NUMERIC(5,2) DEFAULT 0,
  trust_impact_score NUMERIC(5,2) DEFAULT 0,
  time_to_resolution_estimate TEXT,
  confidence_level NUMERIC(5,2) DEFAULT 0,
  supporting_evidence JSONB DEFAULT '[]',
  is_recommended BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  recommendation_reasoning TEXT,
  warnings TEXT[],
  signals_to_watch TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Simulation Feedback table (learning loop)
CREATE TABLE public.simulation_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulation_id UUID NOT NULL REFERENCES public.outcome_simulations(id) ON DELETE CASCADE,
  scenario_id UUID REFERENCES public.simulation_scenarios(id) ON DELETE SET NULL,
  executed_scenario_id UUID REFERENCES public.simulation_scenarios(id) ON DELETE SET NULL,
  actual_outcome JSONB DEFAULT '{}',
  predicted_vs_actual_accuracy NUMERIC(5,2),
  feedback_type TEXT DEFAULT 'outcome', -- outcome, override, correction
  feedback_notes TEXT,
  human_intuition_note TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.outcome_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for outcome_simulations
CREATE POLICY "Users can view outcome simulations" 
  ON public.outcome_simulations FOR SELECT 
  USING (true);

CREATE POLICY "Users can create outcome simulations" 
  ON public.outcome_simulations FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update outcome simulations" 
  ON public.outcome_simulations FOR UPDATE 
  USING (true);

-- RLS Policies for simulation_scenarios
CREATE POLICY "Users can view simulation scenarios" 
  ON public.simulation_scenarios FOR SELECT 
  USING (true);

CREATE POLICY "Users can create simulation scenarios" 
  ON public.simulation_scenarios FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update simulation scenarios" 
  ON public.simulation_scenarios FOR UPDATE 
  USING (true);

-- RLS Policies for simulation_feedback
CREATE POLICY "Users can view simulation feedback" 
  ON public.simulation_feedback FOR SELECT 
  USING (true);

CREATE POLICY "Users can create simulation feedback" 
  ON public.simulation_feedback FOR INSERT 
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_outcome_simulations_conversation ON public.outcome_simulations(conversation_id);
CREATE INDEX idx_outcome_simulations_status ON public.outcome_simulations(status);
CREATE INDEX idx_outcome_simulations_expiry ON public.outcome_simulations(expiry_timestamp);
CREATE INDEX idx_simulation_scenarios_simulation ON public.simulation_scenarios(simulation_id);
CREATE INDEX idx_simulation_scenarios_recommended ON public.simulation_scenarios(is_recommended) WHERE is_recommended = true;
CREATE INDEX idx_simulation_feedback_simulation ON public.simulation_feedback(simulation_id);

-- Trigger to update timestamps
CREATE TRIGGER update_outcome_simulations_updated_at
  BEFORE UPDATE ON public.outcome_simulations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to expire old simulations
CREATE OR REPLACE FUNCTION public.expire_old_simulations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.outcome_simulations
  SET status = 'expired'
  WHERE status = 'active'
    AND expiry_timestamp < now();
END;
$$;
