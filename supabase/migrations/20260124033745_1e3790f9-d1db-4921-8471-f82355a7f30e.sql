-- Add canary_call_log table for detailed tracking of AI-answered calls
CREATE TABLE public.canary_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ai_call_sessions(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  prediction_id UUID REFERENCES public.ai_call_predictions(id) ON DELETE SET NULL,
  
  -- Entry conditions at answer time
  entry_confidence NUMERIC(5,2) NOT NULL,
  entry_trust_score INTEGER NOT NULL,
  entry_accuracy_rate NUMERIC(5,2) NOT NULL,
  callable_users_count INTEGER NOT NULL DEFAULT 0,
  unresolved_calls_count INTEGER NOT NULL DEFAULT 0,
  
  -- Why AI was allowed to answer
  entry_reason TEXT NOT NULL,
  entry_conditions JSONB DEFAULT '{}',
  
  -- Call classification
  call_risk_level TEXT DEFAULT 'low' CHECK (call_risk_level IN ('low', 'medium', 'high')),
  call_type TEXT,
  
  -- Outcome tracking
  outcome TEXT CHECK (outcome IN ('success', 'handoff', 'failure', 'timeout', 'caller_requested_human', 'sentiment_drop')),
  outcome_reason TEXT,
  handoff_requested_at TIMESTAMPTZ,
  handoff_completed_at TIMESTAMPTZ,
  handoff_latency_ms INTEGER,
  
  -- Caller sentiment
  initial_sentiment TEXT,
  final_sentiment TEXT,
  sentiment_changed BOOLEAN DEFAULT false,
  
  -- Duration
  ai_active_duration_seconds INTEGER,
  total_duration_seconds INTEGER,
  
  -- Human override
  human_overrode BOOLEAN DEFAULT false,
  override_user_id UUID,
  override_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add escape hatch events table
CREATE TABLE public.canary_escape_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canary_log_id UUID REFERENCES public.canary_call_log(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.ai_call_sessions(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  escape_type TEXT NOT NULL CHECK (escape_type IN (
    'human_takeover',
    'caller_keyword',
    'timeout',
    'sentiment_drop',
    'confidence_drop',
    'admin_kill_switch',
    'system_error'
  )),
  escape_trigger TEXT,
  escape_details JSONB DEFAULT '{}',
  
  -- Timing
  triggered_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution_latency_ms INTEGER,
  
  -- Result
  was_successful BOOLEAN DEFAULT true,
  failure_reason TEXT
);

-- Add admin kill switch to config
ALTER TABLE public.ai_call_agent_config 
ADD COLUMN IF NOT EXISTS canary_kill_switch BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS canary_max_concurrent INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS canary_allowed_call_types TEXT[] DEFAULT ARRAY['general_inquiry', 'scheduling', 'simple_sales'],
ADD COLUMN IF NOT EXISTS canary_blocked_intents TEXT[] DEFAULT ARRAY['complaint', 'escalation', 'compliance', 'legal'];

-- Add indexes for performance
CREATE INDEX idx_canary_log_business ON public.canary_call_log(business_id);
CREATE INDEX idx_canary_log_session ON public.canary_call_log(session_id);
CREATE INDEX idx_canary_log_outcome ON public.canary_call_log(outcome);
CREATE INDEX idx_canary_escape_type ON public.canary_escape_events(escape_type);

-- Enable RLS
ALTER TABLE public.canary_call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canary_escape_events ENABLE ROW LEVEL SECURITY;

-- RLS policies using business_members table
CREATE POLICY "Users can view canary logs for their businesses" 
ON public.canary_call_log FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.business_members bm 
    WHERE bm.user_id = auth.uid() AND bm.business_id = canary_call_log.business_id
  )
);

CREATE POLICY "Service role can manage canary logs" 
ON public.canary_call_log FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can view escape events for their businesses" 
ON public.canary_escape_events FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.business_members bm 
    WHERE bm.user_id = auth.uid() AND bm.business_id = canary_escape_events.business_id
  )
);

CREATE POLICY "Service role can manage escape events" 
ON public.canary_escape_events FOR ALL 
USING (auth.jwt() ->> 'role' = 'service_role');

-- Enable realtime for canary monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.canary_call_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.canary_escape_events;