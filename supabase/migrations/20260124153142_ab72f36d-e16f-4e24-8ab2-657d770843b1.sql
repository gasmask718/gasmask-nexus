-- ============================================================
-- INCIDENT SIMULATION, FORENSIC REPLAY & REGULATORY READINESS
-- ============================================================

-- Phase 1: Incident Simulation Engine Tables
-- ------------------------------------------

-- Simulation scenario definitions
CREATE TABLE public.incident_simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  name TEXT NOT NULL,
  description TEXT,
  scenario_type TEXT NOT NULL CHECK (scenario_type IN (
    'confidence_collapse',
    'kill_switch_activation',
    'no_human_fallback',
    'conflicting_state_transitions',
    'delayed_audit_logging',
    'speech_overlap',
    'network_latency_spike',
    'partial_transcript_loss',
    'regulatory_violation_attempt',
    'custom'
  )),
  scenario_config JSONB DEFAULT '{}',
  expected_outcome TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Simulation run records
CREATE TABLE public.incident_simulation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simulation_id UUID REFERENCES public.incident_simulations(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'aborted')),
  synthetic_session_id UUID,
  call_state_log JSONB DEFAULT '[]',
  audit_trail JSONB DEFAULT '[]',
  result_summary JSONB,
  passed BOOLEAN,
  failure_reason TEXT,
  run_by UUID,
  run_duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Findings from simulation runs
CREATE TABLE public.incident_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES public.incident_simulation_runs(id) ON DELETE CASCADE,
  simulation_id UUID REFERENCES public.incident_simulations(id),
  finding_type TEXT NOT NULL CHECK (finding_type IN (
    'state_violation',
    'audit_gap',
    'speech_overlap',
    'confidence_breach',
    'kill_switch_failure',
    'human_fallback_failure',
    'latency_breach',
    'transcript_loss',
    'regulatory_violation',
    'unexpected_behavior'
  )),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  description TEXT NOT NULL,
  evidence JSONB,
  timestamp_at TIMESTAMPTZ,
  recommended_action TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phase 2: Forensic Replay Tables
-- -------------------------------

-- Forensic replay sessions
CREATE TABLE public.forensic_replay_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  original_session_id UUID REFERENCES public.ai_call_sessions(id),
  replayed_by UUID,
  replayed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  replay_purpose TEXT,
  notes TEXT,
  exported_at TIMESTAMPTZ,
  export_format TEXT CHECK (export_format IN ('pdf', 'json', 'csv')),
  export_url TEXT,
  row_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Frame-by-frame call state reconstruction
CREATE TABLE public.forensic_call_frames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  replay_session_id UUID REFERENCES public.forensic_replay_sessions(id) ON DELETE CASCADE,
  original_session_id UUID REFERENCES public.ai_call_sessions(id),
  frame_number INTEGER NOT NULL,
  timestamp_ms BIGINT NOT NULL,
  call_state TEXT NOT NULL,
  speaker_allowed TEXT,
  actual_speaker TEXT,
  confidence_level NUMERIC(5,2),
  trust_score NUMERIC(5,2),
  kill_switch_active BOOLEAN DEFAULT false,
  lock_applied BOOLEAN DEFAULT false,
  interruption_detected BOOLEAN DEFAULT false,
  transcript_fragment TEXT,
  state_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phase 3: Regulatory Evidence Tables
-- -----------------------------------

-- Evidence pack generation records
CREATE TABLE public.regulatory_evidence_packs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  pack_type TEXT NOT NULL CHECK (pack_type IN (
    'ai_speech_permission',
    'kill_switch_proof',
    'human_override_proof',
    'confidence_enforcement',
    'training_source_disclosure',
    'human_approval_records',
    'full_compliance_pack'
  )),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID,
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  session_ids UUID[],
  pack_data JSONB NOT NULL,
  log_hashes TEXT[],
  policy_version TEXT,
  system_mode_at_generation TEXT,
  approver_signatures JSONB,
  pdf_url TEXT,
  json_url TEXT,
  csv_url TEXT,
  is_certified BOOLEAN DEFAULT false,
  certified_by UUID,
  certified_at TIMESTAMPTZ,
  row_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phase 4: Incident Drill Tables
-- ------------------------------

-- Drill execution records
CREATE TABLE public.incident_drills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  drill_type TEXT NOT NULL CHECK (drill_type IN (
    'kill_switch_activation',
    'human_takeover',
    'ai_stop_command',
    'confidence_breach_response',
    'mass_escalation',
    'system_failover',
    'audit_persistence',
    'alert_verification'
  )),
  drill_name TEXT NOT NULL,
  description TEXT,
  initiated_by UUID NOT NULL,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'failed', 'cancelled')),
  expected_outcomes JSONB,
  actual_outcomes JSONB,
  ai_stopped_correctly BOOLEAN,
  human_takeover_activated BOOLEAN,
  audit_logs_persisted BOOLEAN,
  alerts_fired_correctly BOOLEAN,
  latency_metrics JSONB,
  drill_readiness_score NUMERIC(5,2),
  findings TEXT[],
  is_drill BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phase 5: Compliance Dashboard Tables
-- ------------------------------------

-- Compliance metrics snapshots
CREATE TABLE public.compliance_metrics_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  snapshot_date DATE NOT NULL,
  snapshot_hour INTEGER CHECK (snapshot_hour >= 0 AND snapshot_hour <= 23),
  total_calls INTEGER DEFAULT 0,
  calls_with_ai_permission INTEGER DEFAULT 0,
  calls_without_permission INTEGER DEFAULT 0,
  permission_rate NUMERIC(5,2),
  kill_switch_activations INTEGER DEFAULT 0,
  kill_switch_success_rate NUMERIC(5,2),
  confidence_breaches INTEGER DEFAULT 0,
  human_takeover_count INTEGER DEFAULT 0,
  avg_human_takeover_latency_ms INTEGER,
  unapproved_technique_uses INTEGER DEFAULT 0,
  audit_completeness_rate NUMERIC(5,2),
  compliance_status TEXT DEFAULT 'compliant' CHECK (compliance_status IN ('compliant', 'warning', 'non_compliant', 'locked')),
  risk_score NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, snapshot_date, snapshot_hour)
);

-- Compliance alerts
CREATE TABLE public.compliance_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'permission_violation',
    'kill_switch_failure',
    'confidence_breach',
    'audit_gap',
    'unapproved_technique',
    'human_takeover_delay',
    'system_locked',
    'drill_failure'
  )),
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  evidence JSONB,
  session_id UUID REFERENCES public.ai_call_sessions(id),
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.incident_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_simulation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forensic_replay_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forensic_call_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulatory_evidence_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_metrics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users
CREATE POLICY "Users can view simulations for their business" ON public.incident_simulations FOR SELECT USING (true);
CREATE POLICY "Users can manage simulations" ON public.incident_simulations FOR ALL USING (true);

CREATE POLICY "Users can view simulation runs" ON public.incident_simulation_runs FOR SELECT USING (true);
CREATE POLICY "Users can manage simulation runs" ON public.incident_simulation_runs FOR ALL USING (true);

CREATE POLICY "Users can view findings" ON public.incident_findings FOR SELECT USING (true);
CREATE POLICY "Users can manage findings" ON public.incident_findings FOR ALL USING (true);

CREATE POLICY "Users can view forensic replays" ON public.forensic_replay_sessions FOR SELECT USING (true);
CREATE POLICY "Users can create forensic replays" ON public.forensic_replay_sessions FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view forensic frames" ON public.forensic_call_frames FOR SELECT USING (true);
CREATE POLICY "Users can create forensic frames" ON public.forensic_call_frames FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view evidence packs" ON public.regulatory_evidence_packs FOR SELECT USING (true);
CREATE POLICY "Users can create evidence packs" ON public.regulatory_evidence_packs FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view drills" ON public.incident_drills FOR SELECT USING (true);
CREATE POLICY "Users can manage drills" ON public.incident_drills FOR ALL USING (true);

CREATE POLICY "Users can view compliance metrics" ON public.compliance_metrics_snapshots FOR SELECT USING (true);
CREATE POLICY "Users can insert compliance metrics" ON public.compliance_metrics_snapshots FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view compliance alerts" ON public.compliance_alerts FOR SELECT USING (true);
CREATE POLICY "Users can manage compliance alerts" ON public.compliance_alerts FOR ALL USING (true);

-- Indexes for performance
CREATE INDEX idx_incident_simulations_business ON public.incident_simulations(business_id);
CREATE INDEX idx_incident_simulation_runs_simulation ON public.incident_simulation_runs(simulation_id);
CREATE INDEX idx_incident_findings_run ON public.incident_findings(run_id);
CREATE INDEX idx_forensic_replay_sessions_original ON public.forensic_replay_sessions(original_session_id);
CREATE INDEX idx_forensic_call_frames_replay ON public.forensic_call_frames(replay_session_id);
CREATE INDEX idx_forensic_call_frames_timestamp ON public.forensic_call_frames(timestamp_ms);
CREATE INDEX idx_regulatory_evidence_packs_business ON public.regulatory_evidence_packs(business_id);
CREATE INDEX idx_regulatory_evidence_packs_type ON public.regulatory_evidence_packs(pack_type);
CREATE INDEX idx_incident_drills_business ON public.incident_drills(business_id);
CREATE INDEX idx_compliance_metrics_business_date ON public.compliance_metrics_snapshots(business_id, snapshot_date);
CREATE INDEX idx_compliance_alerts_business ON public.compliance_alerts(business_id);
CREATE INDEX idx_compliance_alerts_unresolved ON public.compliance_alerts(business_id) WHERE resolved = false;

-- Trigger for updated_at
CREATE TRIGGER update_incident_simulations_updated_at
  BEFORE UPDATE ON public.incident_simulations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();