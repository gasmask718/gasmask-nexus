
-- Human Shadow Mode, Trust Calibration & Assisted AI Graduation Schema

-- Shadow predictions: AI's silent predictions during human calls
CREATE TABLE public.call_shadow_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ai_call_sessions(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  human_operator_id UUID,
  
  -- What AI would have done
  predicted_intent TEXT NOT NULL,
  predicted_response TEXT NOT NULL,
  predicted_next_action TEXT,
  predicted_escalation BOOLEAN DEFAULT false,
  predicted_route TEXT,
  
  -- Confidence and reasoning
  confidence_score NUMERIC(5,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  reasoning TEXT,
  risk_flags TEXT[] DEFAULT '{}',
  
  -- Timing
  transcript_snapshot TEXT,
  prediction_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  processing_time_ms INTEGER,
  
  -- What human actually did (filled in after)
  human_actual_response TEXT,
  human_actual_action TEXT,
  human_escalated BOOLEAN,
  human_response_timestamp TIMESTAMPTZ,
  
  -- Comparison results
  would_have_matched BOOLEAN,
  comparison_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trust calibration scores: AI vs human decision comparison metrics
CREATE TABLE public.trust_calibration_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  
  -- Scope of this calibration
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'playbook', 'style', 'intent', 'operator')),
  scope_id TEXT, -- playbook_id, style_id, intent name, or operator_id
  
  -- Core trust metrics (0-100)
  overall_trust_score NUMERIC(5,2) DEFAULT 0,
  resolution_accuracy NUMERIC(5,2) DEFAULT 0,    -- Would AI have resolved correctly?
  escalation_timing NUMERIC(5,2) DEFAULT 0,      -- Would AI have escalated at right time?
  compliance_adherence NUMERIC(5,2) DEFAULT 0,   -- Would AI have followed rules?
  efficiency_score NUMERIC(5,2) DEFAULT 0,       -- Would AI have been faster/better?
  
  -- Comparison stats
  total_comparisons INTEGER DEFAULT 0,
  ai_would_have_matched INTEGER DEFAULT 0,
  ai_would_have_been_better INTEGER DEFAULT 0,
  ai_would_have_been_worse INTEGER DEFAULT 0,
  ai_would_have_violated_rules INTEGER DEFAULT 0,
  
  -- Trend tracking
  score_trend TEXT CHECK (score_trend IN ('improving', 'stable', 'declining')),
  consecutive_good_predictions INTEGER DEFAULT 0,
  consecutive_bad_predictions INTEGER DEFAULT 0,
  
  -- Time windows
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  last_calibrated_at TIMESTAMPTZ DEFAULT now(),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI vs Human diff logs: detailed comparison records
CREATE TABLE public.ai_vs_human_diff_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shadow_prediction_id UUID REFERENCES public.call_shadow_predictions(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.ai_call_sessions(id) ON DELETE SET NULL,
  
  -- The comparison
  comparison_type TEXT NOT NULL CHECK (comparison_type IN ('response', 'escalation', 'routing', 'timing', 'tone', 'compliance')),
  
  -- AI side
  ai_decision TEXT NOT NULL,
  ai_confidence NUMERIC(5,2),
  ai_reasoning TEXT,
  
  -- Human side
  human_decision TEXT NOT NULL,
  human_context TEXT, -- Why human chose differently
  
  -- Verdict
  verdict TEXT NOT NULL CHECK (verdict IN ('ai_correct', 'human_correct', 'both_valid', 'ai_violation', 'inconclusive')),
  verdict_reason TEXT,
  
  -- Impact assessment
  impact_severity TEXT CHECK (impact_severity IN ('none', 'minor', 'moderate', 'major', 'critical')),
  would_have_caused_escalation BOOLEAN DEFAULT false,
  would_have_violated_compliance BOOLEAN DEFAULT false,
  
  -- Reviewer (optional human review of the diff)
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI graduation events: promotion/demotion audit trail
CREATE TABLE public.ai_graduation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  
  -- The transition
  from_mode TEXT NOT NULL CHECK (from_mode IN ('off', 'shadow', 'assisted', 'canary', 'live')),
  to_mode TEXT NOT NULL CHECK (to_mode IN ('off', 'shadow', 'assisted', 'canary', 'live')),
  event_type TEXT NOT NULL CHECK (event_type IN ('promotion', 'demotion', 'manual_override', 'emergency_stop', 'scheduled_review')),
  
  -- Decision basis
  trigger_reason TEXT NOT NULL,
  trust_score_at_event NUMERIC(5,2),
  calibration_data JSONB DEFAULT '{}',
  
  -- Thresholds that were checked
  thresholds_checked JSONB DEFAULT '{}',
  thresholds_passed BOOLEAN NOT NULL,
  
  -- Approval chain
  requested_by TEXT, -- 'system' or user_id
  approved_by UUID,  -- Required for promotions
  approval_notes TEXT,
  
  -- Reversibility
  is_reversible BOOLEAN DEFAULT true,
  reversed_at TIMESTAMPTZ,
  reversed_by UUID,
  reversal_reason TEXT,
  
  -- Audit
  decision_trace_id UUID DEFAULT gen_random_uuid(),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Graduation thresholds configuration per business
CREATE TABLE public.ai_graduation_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Shadow → Assisted thresholds
  shadow_to_assisted_min_predictions INTEGER DEFAULT 100,
  shadow_to_assisted_min_accuracy NUMERIC(5,2) DEFAULT 75,
  shadow_to_assisted_max_violations INTEGER DEFAULT 0,
  shadow_to_assisted_min_days INTEGER DEFAULT 7,
  
  -- Assisted → Canary thresholds
  assisted_to_canary_min_suggestions INTEGER DEFAULT 200,
  assisted_to_canary_min_acceptance_rate NUMERIC(5,2) DEFAULT 80,
  assisted_to_canary_min_trust_score NUMERIC(5,2) DEFAULT 85,
  assisted_to_canary_min_days INTEGER DEFAULT 14,
  
  -- Canary → Live thresholds
  canary_to_live_min_calls INTEGER DEFAULT 500,
  canary_to_live_min_success_rate NUMERIC(5,2) DEFAULT 90,
  canary_to_live_min_trust_score NUMERIC(5,2) DEFAULT 92,
  canary_to_live_max_escalation_rate NUMERIC(5,2) DEFAULT 10,
  canary_to_live_min_days INTEGER DEFAULT 30,
  
  -- Demotion triggers
  demotion_consecutive_failures INTEGER DEFAULT 3,
  demotion_trust_score_floor NUMERIC(5,2) DEFAULT 70,
  demotion_violation_threshold INTEGER DEFAULT 1,
  
  -- Approval requirements
  require_human_approval_for_promotion BOOLEAN DEFAULT true,
  require_human_approval_for_demotion BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI suggestion logs (for Assisted Mode)
CREATE TABLE public.ai_suggestion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ai_call_sessions(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  operator_id UUID,
  
  -- The suggestion
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('response', 'next_action', 'escalation', 'routing', 'risk_alert')),
  suggestion_content TEXT NOT NULL,
  suggestion_reasoning TEXT,
  confidence_score NUMERIC(5,2),
  
  -- Context
  transcript_at_suggestion TEXT,
  detected_intent TEXT,
  risk_flags TEXT[] DEFAULT '{}',
  
  -- Operator response
  operator_action TEXT CHECK (operator_action IN ('accepted', 'modified', 'rejected', 'ignored')),
  operator_response TEXT, -- What they actually did
  operator_feedback TEXT, -- Optional feedback
  response_time_ms INTEGER,
  
  -- Scoring
  was_helpful BOOLEAN,
  would_have_been_correct BOOLEAN,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acted_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_shadow_predictions_business ON public.call_shadow_predictions(business_id);
CREATE INDEX idx_shadow_predictions_session ON public.call_shadow_predictions(session_id);
CREATE INDEX idx_shadow_predictions_timestamp ON public.call_shadow_predictions(prediction_timestamp DESC);

CREATE INDEX idx_trust_calibration_business ON public.trust_calibration_scores(business_id);
CREATE INDEX idx_trust_calibration_scope ON public.trust_calibration_scores(scope_type, scope_id);

CREATE INDEX idx_diff_logs_business ON public.ai_vs_human_diff_logs(business_id);
CREATE INDEX idx_diff_logs_verdict ON public.ai_vs_human_diff_logs(verdict);

CREATE INDEX idx_graduation_events_business ON public.ai_graduation_events(business_id);
CREATE INDEX idx_graduation_events_type ON public.ai_graduation_events(event_type);

CREATE INDEX idx_suggestion_logs_business ON public.ai_suggestion_logs(business_id);
CREATE INDEX idx_suggestion_logs_session ON public.ai_suggestion_logs(session_id);
CREATE INDEX idx_suggestion_logs_action ON public.ai_suggestion_logs(operator_action);

-- Enable RLS
ALTER TABLE public.call_shadow_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_calibration_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_vs_human_diff_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_graduation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_graduation_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_suggestion_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (authenticated users can read their business data)
CREATE POLICY "Users can view shadow predictions for their business"
ON public.call_shadow_predictions FOR SELECT TO authenticated
USING (true);

CREATE POLICY "System can insert shadow predictions"
ON public.call_shadow_predictions FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can view trust calibration scores"
ON public.trust_calibration_scores FOR SELECT TO authenticated
USING (true);

CREATE POLICY "System can manage trust calibration scores"
ON public.trust_calibration_scores FOR ALL TO authenticated
USING (true);

CREATE POLICY "Users can view diff logs"
ON public.ai_vs_human_diff_logs FOR SELECT TO authenticated
USING (true);

CREATE POLICY "System can insert diff logs"
ON public.ai_vs_human_diff_logs FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can view graduation events"
ON public.ai_graduation_events FOR SELECT TO authenticated
USING (true);

CREATE POLICY "System can manage graduation events"
ON public.ai_graduation_events FOR ALL TO authenticated
USING (true);

CREATE POLICY "Users can view graduation thresholds"
ON public.ai_graduation_thresholds FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can manage graduation thresholds"
ON public.ai_graduation_thresholds FOR ALL TO authenticated
USING (true);

CREATE POLICY "Users can view suggestion logs"
ON public.ai_suggestion_logs FOR SELECT TO authenticated
USING (true);

CREATE POLICY "System can manage suggestion logs"
ON public.ai_suggestion_logs FOR ALL TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_trust_calibration_updated_at
  BEFORE UPDATE ON public.trust_calibration_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_graduation_thresholds_updated_at
  BEFORE UPDATE ON public.ai_graduation_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
