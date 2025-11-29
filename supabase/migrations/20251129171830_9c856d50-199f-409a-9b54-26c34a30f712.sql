-- Phase 29: Unified Advisor Brain Tables

-- Advisor Sessions - stores advice conversations
CREATE TABLE public.advisor_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  session_type TEXT NOT NULL DEFAULT 'advice' CHECK (session_type IN ('advice', 'simulation', 'deep_dive')),
  input_prompt TEXT,
  context_sources TEXT[] DEFAULT '{}',
  ai_summary TEXT,
  ai_recommendations TEXT[] DEFAULT '{}',
  action_items JSONB DEFAULT '[]',
  risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  confidence_score INTEGER DEFAULT 50,
  mode TEXT DEFAULT 'business' CHECK (mode IN ('business', 'personal', 'mixed')),
  time_window TEXT DEFAULT 'today',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Advisor Scenarios - stores "what if" simulations
CREATE TABLE public.advisor_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  scenario_name TEXT NOT NULL,
  scenario_type TEXT NOT NULL,
  inputs JSONB DEFAULT '{}',
  baseline_metrics JSONB DEFAULT '{}',
  projected_metrics JSONB DEFAULT '{}',
  ai_analysis TEXT,
  ai_recommendations TEXT[] DEFAULT '{}',
  is_favorable BOOLEAN,
  risk_rating TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Advisor Action Log - tracks suggested/accepted actions
CREATE TABLE public.advisor_action_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  source_session_id UUID REFERENCES public.advisor_sessions(id),
  action_label TEXT NOT NULL,
  action_type TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id TEXT,
  status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'rejected', 'done')),
  priority INTEGER DEFAULT 5,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.advisor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_action_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admins manage all, users see their own
CREATE POLICY "Admins manage advisor_sessions" ON public.advisor_sessions 
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own advisor_sessions" ON public.advisor_sessions 
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own advisor_sessions" ON public.advisor_sessions 
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Admins manage advisor_scenarios" ON public.advisor_scenarios 
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own advisor_scenarios" ON public.advisor_scenarios 
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own advisor_scenarios" ON public.advisor_scenarios 
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Admins manage advisor_action_log" ON public.advisor_action_log 
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own advisor_action_log" ON public.advisor_action_log 
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own advisor_action_log" ON public.advisor_action_log 
  FOR UPDATE USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_advisor_sessions_user ON public.advisor_sessions(user_id, created_at DESC);
CREATE INDEX idx_advisor_scenarios_user ON public.advisor_scenarios(user_id, created_at DESC);
CREATE INDEX idx_advisor_action_log_status ON public.advisor_action_log(status, created_at DESC);