-- AI Call Agent Configuration per Business
CREATE TABLE public.ai_call_agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  mode TEXT DEFAULT 'shadow' CHECK (mode IN ('off', 'shadow', 'assisted', 'canary', 'live')),
  confidence_threshold INTEGER DEFAULT 85 CHECK (confidence_threshold >= 0 AND confidence_threshold <= 100),
  require_callable_fallback BOOLEAN DEFAULT true,
  require_resolved_queue BOOLEAN DEFAULT true,
  max_consecutive_failures INTEGER DEFAULT 3,
  auto_downgrade_on_failure BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id)
);

-- AI Call Predictions (Shadow Mode Records)
CREATE TABLE public.ai_call_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ai_call_sessions(id) ON DELETE SET NULL,
  call_log_id UUID REFERENCES public.ai_call_logs(id) ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  caller_phone TEXT,
  predicted_intent TEXT,
  predicted_route TEXT,
  drafted_response TEXT,
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  actual_outcome TEXT,
  human_overrode BOOLEAN DEFAULT false,
  override_reason TEXT,
  was_accurate BOOLEAN,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI Trust Scores per Business/Route
CREATE TABLE public.ai_trust_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  route_id UUID REFERENCES public.inbound_call_routes(id) ON DELETE SET NULL,
  current_mode TEXT DEFAULT 'shadow' CHECK (current_mode IN ('shadow', 'assisted', 'canary', 'live')),
  trust_score INTEGER DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 100),
  total_predictions INTEGER DEFAULT 0,
  accurate_predictions INTEGER DEFAULT 0,
  accuracy_rate NUMERIC(5,2) DEFAULT 0,
  human_override_count INTEGER DEFAULT 0,
  consecutive_successes INTEGER DEFAULT 0,
  consecutive_failures INTEGER DEFAULT 0,
  last_failure_reason TEXT,
  last_evaluated_at TIMESTAMPTZ,
  promoted_at TIMESTAMPTZ,
  demoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, route_id)
);

-- AI Performance Metrics (Aggregated)
CREATE TABLE public.ai_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_type TEXT DEFAULT 'daily' CHECK (period_type IN ('hourly', 'daily', 'weekly')),
  total_calls INTEGER DEFAULT 0,
  ai_handled_calls INTEGER DEFAULT 0,
  ai_escalated_calls INTEGER DEFAULT 0,
  missed_call_prevention_count INTEGER DEFAULT 0,
  callback_success_count INTEGER DEFAULT 0,
  average_confidence NUMERIC(5,2),
  average_accuracy NUMERIC(5,2),
  human_satisfaction_score NUMERIC(3,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, period_start, period_type)
);

-- AI Call Agent Failure Logs
CREATE TABLE public.ai_agent_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  prediction_id UUID REFERENCES public.ai_call_predictions(id) ON DELETE SET NULL,
  failure_type TEXT NOT NULL,
  failure_reason TEXT,
  was_escalated BOOLEAN DEFAULT false,
  escalated_to UUID,
  resolution_status TEXT DEFAULT 'pending',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_call_agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_call_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_failures ENABLE ROW LEVEL SECURITY;

-- RLS Policies using business_members for access control
CREATE POLICY "Users can view their business AI config" ON public.ai_call_agent_config
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.business_members WHERE business_members.user_id = auth.uid() AND business_members.business_id = ai_call_agent_config.business_id)
  );

CREATE POLICY "Users can manage their business AI config" ON public.ai_call_agent_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.business_members WHERE business_members.user_id = auth.uid() AND business_members.business_id = ai_call_agent_config.business_id)
  );

CREATE POLICY "Users can view their business predictions" ON public.ai_call_predictions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.business_members WHERE business_members.user_id = auth.uid() AND business_members.business_id = ai_call_predictions.business_id)
  );

CREATE POLICY "Service role can insert predictions" ON public.ai_call_predictions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their business trust scores" ON public.ai_trust_scores
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.business_members WHERE business_members.user_id = auth.uid() AND business_members.business_id = ai_trust_scores.business_id)
  );

CREATE POLICY "Service role can manage trust scores" ON public.ai_trust_scores
  FOR ALL USING (true);

CREATE POLICY "Users can view their business metrics" ON public.ai_performance_metrics
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.business_members WHERE business_members.user_id = auth.uid() AND business_members.business_id = ai_performance_metrics.business_id)
  );

CREATE POLICY "Users can view their business failures" ON public.ai_agent_failures
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.business_members WHERE business_members.user_id = auth.uid() AND business_members.business_id = ai_agent_failures.business_id)
  );

-- Indexes for performance
CREATE INDEX idx_ai_predictions_business ON public.ai_call_predictions(business_id);
CREATE INDEX idx_ai_predictions_session ON public.ai_call_predictions(session_id);
CREATE INDEX idx_ai_predictions_created ON public.ai_call_predictions(created_at DESC);
CREATE INDEX idx_ai_trust_scores_business ON public.ai_trust_scores(business_id);
CREATE INDEX idx_ai_metrics_business_period ON public.ai_performance_metrics(business_id, period_start DESC);
CREATE INDEX idx_ai_failures_business ON public.ai_agent_failures(business_id);

-- Enable realtime for trust scores (so UI can update live)
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_trust_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_call_predictions;