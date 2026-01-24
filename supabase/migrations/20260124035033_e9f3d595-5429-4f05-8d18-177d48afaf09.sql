-- ═══════════════════════════════════════════════════════════════════════════
-- AI CALL AGENT — LIVE MODE SCHEMA
-- Decision ledger, risk events, audit logs, regulatory compliance
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. AI Call Decisions - Immutable decision ledger for every AI choice
CREATE TABLE public.ai_call_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ai_call_sessions(id),
  business_id UUID REFERENCES public.businesses(id),
  decision_type TEXT NOT NULL, -- 'continue', 'escalate', 'handoff', 'terminate'
  decision_reason TEXT NOT NULL,
  confidence_at_decision NUMERIC(5,2),
  risk_level TEXT DEFAULT 'low', -- 'low', 'medium', 'high'
  active_thresholds JSONB DEFAULT '{}',
  rule_applied TEXT, -- which rule allowed/triggered this decision
  caller_sentiment TEXT,
  intent_at_decision TEXT,
  transcript_snapshot TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. AI Risk Events - Risk classification events during calls
CREATE TABLE public.ai_risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ai_call_sessions(id),
  business_id UUID REFERENCES public.businesses(id),
  risk_level TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  risk_triggers TEXT[] DEFAULT '{}', -- what triggered the risk
  previous_risk_level TEXT,
  escalation_required BOOLEAN DEFAULT false,
  escalation_executed BOOLEAN DEFAULT false,
  human_notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. AI Audit Logs - Immutable audit records for compliance
CREATE TABLE public.ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.ai_call_sessions(id),
  business_id UUID REFERENCES public.businesses(id),
  audit_type TEXT NOT NULL, -- 'call_start', 'disclosure', 'decision', 'escalation', 'call_end'
  payload JSONB NOT NULL,
  transcript_at_event TEXT,
  confidence_timeline JSONB DEFAULT '[]',
  intent_timeline JSONB DEFAULT '[]',
  sentiment_timeline JSONB DEFAULT '[]',
  is_immutable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Mode Transition Logs - Tracking all mode changes
CREATE TABLE public.mode_transition_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id),
  from_mode TEXT NOT NULL,
  to_mode TEXT NOT NULL,
  trigger_reason TEXT NOT NULL, -- 'admin_manual', 'auto_downgrade', 'trust_threshold', etc.
  trigger_details JSONB DEFAULT '{}',
  triggered_by UUID, -- user_id if manual
  was_automatic BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Regulatory Exports - Compliance export records
CREATE TABLE public.regulatory_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses(id),
  export_type TEXT NOT NULL, -- 'audit_report', 'call_evidence', 'compliance_packet'
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  included_sessions UUID[] DEFAULT '{}',
  pii_redacted BOOLEAN DEFAULT true,
  export_url TEXT,
  requested_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Update ai_call_agent_config with live mode fields
ALTER TABLE public.ai_call_agent_config
ADD COLUMN IF NOT EXISTS live_mode_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS live_trust_threshold NUMERIC(5,2) DEFAULT 92,
ADD COLUMN IF NOT EXISTS live_max_override_rate NUMERIC(5,2) DEFAULT 10,
ADD COLUMN IF NOT EXISTS live_min_canary_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS live_kill_switch BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_disclosure_script TEXT DEFAULT 'You''re speaking with the automated assistant for [Business Name]. A human representative is available at any time.',
ADD COLUMN IF NOT EXISTS consent_recording_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS data_retention_days INTEGER DEFAULT 90,
ADD COLUMN IF NOT EXISTS high_risk_keywords TEXT[] DEFAULT ARRAY['lawyer', 'attorney', 'sue', 'lawsuit', 'legal', 'complaint', 'refund', 'cancel', 'fraud', 'scam'],
ADD COLUMN IF NOT EXISTS escape_phrases TEXT[] DEFAULT ARRAY['human', 'representative', 'agent', 'person', 'operator', 'real person'];

-- 7. Enable RLS on all new tables
ALTER TABLE public.ai_call_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mode_transition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_exports ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies - authenticated users can read their business data
CREATE POLICY "Users can view ai_call_decisions" ON public.ai_call_decisions
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view ai_risk_events" ON public.ai_risk_events
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view ai_audit_logs" ON public.ai_audit_logs
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view mode_transition_logs" ON public.mode_transition_logs
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view regulatory_exports" ON public.regulatory_exports
FOR SELECT USING (auth.uid() IS NOT NULL);

-- Service role can insert (edge functions)
CREATE POLICY "Service can insert ai_call_decisions" ON public.ai_call_decisions
FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can insert ai_risk_events" ON public.ai_risk_events
FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can insert ai_audit_logs" ON public.ai_audit_logs
FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can insert mode_transition_logs" ON public.mode_transition_logs
FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can insert regulatory_exports" ON public.regulatory_exports
FOR INSERT WITH CHECK (true);

-- 9. Indexes for performance
CREATE INDEX idx_ai_call_decisions_session ON public.ai_call_decisions(session_id);
CREATE INDEX idx_ai_call_decisions_business ON public.ai_call_decisions(business_id);
CREATE INDEX idx_ai_risk_events_session ON public.ai_risk_events(session_id);
CREATE INDEX idx_ai_audit_logs_session ON public.ai_audit_logs(session_id);
CREATE INDEX idx_mode_transition_logs_business ON public.mode_transition_logs(business_id);
CREATE INDEX idx_regulatory_exports_business ON public.regulatory_exports(business_id);

-- 10. Enable realtime for live monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_call_decisions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_risk_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mode_transition_logs;