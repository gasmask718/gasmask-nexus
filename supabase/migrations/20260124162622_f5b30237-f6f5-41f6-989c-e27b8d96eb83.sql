-- =====================================================
-- GOVERNED OUTBOUND SALES & GROWTH ENGINE
-- Complete schema for campaigns, playbooks, kill switches, compliance
-- =====================================================

-- 1. OUTBOUND CAMPAIGNS (Core campaign management)
CREATE TABLE public.outbound_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Campaign Metadata
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('product_launch', 'vendor_recruitment', 'marketplace_growth', 'store_reactivation', 'b2b_outreach')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'active', 'paused', 'halted', 'completed', 'cancelled')),
  
  -- Approval chain
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  
  -- Targeting Rules
  audience_type TEXT NOT NULL DEFAULT 'existing_customers' CHECK (audience_type IN ('existing_customers', 'b2b_prospects', 'lapsed_customers', 'new_leads')),
  allowed_business_types TEXT[] DEFAULT '{}',
  geographic_scope JSONB DEFAULT '{}', -- {states: [], countries: [], regions: []}
  
  -- Rate Limiting & Safety
  max_calls_per_day INTEGER DEFAULT 100,
  max_calls_per_contact INTEGER DEFAULT 3,
  cooldown_period_days INTEGER DEFAULT 7,
  
  -- Compliance Rules (CRITICAL)
  b2b_only BOOLEAN NOT NULL DEFAULT true, -- Never allow consumer cold calls
  jurisdiction_restrictions JSONB DEFAULT '{}',
  mandatory_ai_disclosure TEXT NOT NULL DEFAULT 'This is an automated call on behalf of our company. You are speaking with an AI assistant.',
  prohibited_claims TEXT[] DEFAULT '{}',
  required_disclaimers TEXT[] DEFAULT '{}',
  
  -- Playbook binding
  product_playbook_id UUID,
  vendor_playbook_id UUID,
  
  -- Metrics & Outcomes
  total_targets INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,
  calls_answered INTEGER DEFAULT 0,
  opt_outs INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  escalations INTEGER DEFAULT 0,
  
  -- Kill switch binding
  kill_switch_triggered BOOLEAN DEFAULT false,
  kill_switch_triggered_at TIMESTAMPTZ,
  kill_switch_reason TEXT,
  
  -- Sentinel binding (CRITICAL)
  requires_sentinel_approval BOOLEAN DEFAULT true,
  sentinel_approved BOOLEAN DEFAULT false,
  sentinel_approval_id UUID,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Hash chain for immutability
  row_hash TEXT,
  prev_hash TEXT
);

-- 2. PRODUCT LAUNCH PLAYBOOKS (For product introductions)
CREATE TABLE public.product_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Product Info
  product_name TEXT NOT NULL,
  product_description TEXT NOT NULL,
  target_store_profile JSONB DEFAULT '{}', -- {types: [], volume_tiers: [], regions: []}
  
  -- Approved Language (AI may ONLY use these)
  key_value_propositions TEXT[] NOT NULL DEFAULT '{}',
  allowed_pricing_language TEXT[] DEFAULT '{}',
  objection_handling JSONB DEFAULT '{}', -- {objection: response}
  
  -- Forbidden Actions (AI may NEVER do these)
  forbidden_promises TEXT[] DEFAULT '{}',
  forbidden_pricing_claims TEXT[] DEFAULT '{}',
  forbidden_commitments TEXT[] DEFAULT '{}',
  
  -- Escalation Triggers
  escalation_triggers TEXT[] DEFAULT '{"competitor_mention", "legal_question", "price_negotiation", "complaint", "regulatory_concern"}',
  
  -- Conversion Goals
  conversion_goals TEXT[] DEFAULT '{"interest_expressed", "order_placed", "demo_scheduled", "callback_requested"}',
  
  -- Confidence Floor (AI must meet this to proceed)
  confidence_floor NUMERIC(3,2) DEFAULT 0.80,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. VENDOR RECRUITMENT PLAYBOOKS (For Unforgettable Times marketplace)
CREATE TABLE public.vendor_recruitment_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Vendor Category
  service_category TEXT NOT NULL, -- venue, rental, dj, caterer, photographer, florist, etc.
  
  -- Outreach Goals
  outreach_goal TEXT NOT NULL DEFAULT 'listing_signup' CHECK (outreach_goal IN ('listing_signup', 'intro_call', 'demo', 'partnership')),
  
  -- Approved Messaging
  website_signup_explanation TEXT NOT NULL,
  benefits_framing TEXT[] NOT NULL DEFAULT '{}', -- traffic, bookings, exposure, etc.
  platform_value_props TEXT[] DEFAULT '{}',
  
  -- Objection Handling
  objection_handling JSONB DEFAULT '{}',
  opt_out_phrasing TEXT DEFAULT 'I understand. I will remove you from our contact list. Thank you for your time.',
  
  -- Escalation
  escalation_triggers TEXT[] DEFAULT '{"existing_relationship", "technical_questions", "pricing_inquiry", "complaint"}',
  escalate_to_human_role TEXT DEFAULT 'sales_rep',
  
  -- Mandatory Statements
  must_state_business_identity BOOLEAN DEFAULT true,
  must_state_purpose BOOLEAN DEFAULT true,
  must_offer_opt_out BOOLEAN DEFAULT true,
  no_pressure_tactics BOOLEAN DEFAULT true,
  
  -- Confidence Floor
  confidence_floor NUMERIC(3,2) DEFAULT 0.75,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CAMPAIGN TARGETS (Who to call)
CREATE TABLE public.outbound_campaign_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE,
  
  -- Target Info
  target_type TEXT NOT NULL CHECK (target_type IN ('store', 'vendor', 'organization', 'contact')),
  target_id UUID NOT NULL, -- References store_master, organizations, or people
  target_name TEXT,
  target_phone TEXT NOT NULL,
  target_email TEXT,
  
  -- Targeting Metadata
  priority_score INTEGER DEFAULT 50 CHECK (priority_score >= 0 AND priority_score <= 100),
  targeting_reason TEXT,
  
  -- Call Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'calling', 'completed', 'failed', 'opted_out', 'skipped', 'escalated')),
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_after TIMESTAMPTZ,
  
  -- Outcome
  outcome TEXT,
  outcome_details JSONB,
  conversion_achieved BOOLEAN DEFAULT false,
  escalated_to UUID REFERENCES auth.users(id),
  
  -- Opt-out handling
  opted_out BOOLEAN DEFAULT false,
  opted_out_at TIMESTAMPTZ,
  opt_out_method TEXT, -- verbal, system, email
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. CAMPAIGN KILL SWITCHES (Multi-level emergency stops)
CREATE TABLE public.campaign_kill_switches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Scope
  scope TEXT NOT NULL CHECK (scope IN ('global', 'business', 'campaign')),
  business_id UUID REFERENCES public.businesses(id),
  campaign_id UUID REFERENCES public.outbound_campaigns(id),
  
  -- State
  is_active BOOLEAN NOT NULL DEFAULT true, -- true = calls can proceed, false = STOP
  triggered_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users(id),
  trigger_reason TEXT,
  
  -- Auto-trigger thresholds
  auto_trigger_opt_out_rate NUMERIC(3,2) DEFAULT 0.10, -- 10% opt-out = auto-halt
  auto_trigger_escalation_rate NUMERIC(3,2) DEFAULT 0.20, -- 20% escalation = auto-halt
  auto_trigger_complaint_count INTEGER DEFAULT 3,
  
  -- Resume requirements
  resume_requires_approval BOOLEAN DEFAULT true,
  resumed_by UUID REFERENCES auth.users(id),
  resumed_at TIMESTAMPTZ,
  resume_notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Immutable logging
  is_immutable BOOLEAN DEFAULT false,
  row_hash TEXT
);

-- 6. OPT-OUT REGISTRY (Critical for compliance)
CREATE TABLE public.outbound_opt_out_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contact Info (normalized)
  phone_number TEXT NOT NULL,
  email TEXT,
  
  -- Scope
  business_id UUID REFERENCES public.businesses(id), -- NULL = global opt-out
  campaign_id UUID REFERENCES public.outbound_campaigns(id), -- NULL = all campaigns
  
  -- Opt-out Details
  opt_out_method TEXT NOT NULL CHECK (opt_out_method IN ('verbal', 'sms_reply', 'email', 'web_form', 'system_detected', 'manual_entry')),
  opt_out_source TEXT, -- campaign_id, call_id, etc.
  
  -- Compliance
  recorded_by UUID REFERENCES auth.users(id),
  recording_url TEXT, -- Link to call recording proving opt-out
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ, -- NULL = permanent
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent duplicate opt-outs for same phone/business combo
  UNIQUE(phone_number, business_id)
);

-- 7. CAMPAIGN CALL LOGS (Audit trail for every call)
CREATE TABLE public.outbound_campaign_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.outbound_campaigns(id),
  target_id UUID NOT NULL REFERENCES public.outbound_campaign_targets(id),
  
  -- Call Details
  call_sid TEXT, -- Twilio call SID
  session_id UUID REFERENCES public.ai_call_sessions(id),
  
  -- Playbook Used
  product_playbook_id UUID REFERENCES public.product_playbooks(id),
  vendor_playbook_id UUID REFERENCES public.vendor_recruitment_playbooks(id),
  
  -- Script Sections Used
  script_sections_used TEXT[] DEFAULT '{}',
  ai_disclosed_identity BOOLEAN DEFAULT false,
  stated_purpose BOOLEAN DEFAULT false,
  offered_opt_out BOOLEAN DEFAULT false,
  
  -- Confidence & Safety
  confidence_timeline JSONB DEFAULT '[]',
  min_confidence NUMERIC(3,2),
  max_confidence NUMERIC(3,2),
  avg_confidence NUMERIC(3,2),
  
  -- Objections & Escalations
  objections_raised TEXT[] DEFAULT '{}',
  escalation_triggered BOOLEAN DEFAULT false,
  escalation_reason TEXT,
  escalated_to UUID REFERENCES auth.users(id),
  
  -- Outcome
  call_outcome TEXT CHECK (call_outcome IN ('interested', 'not_interested', 'callback_requested', 'order_placed', 'demo_scheduled', 'opted_out', 'no_answer', 'voicemail', 'escalated', 'failed', 'aborted')),
  outcome_details JSONB,
  
  -- Compliance Flags
  compliance_violations TEXT[] DEFAULT '{}',
  kill_switch_triggered BOOLEAN DEFAULT false,
  
  -- Duration & Timing
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  -- Forensic Replay Link
  forensic_replay_id UUID,
  
  -- Hash chain for immutability
  row_hash TEXT,
  prev_hash TEXT,
  is_immutable BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. CAMPAIGN ANALYTICS (Aggregated metrics)
CREATE TABLE public.outbound_campaign_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE,
  
  -- Time bucket
  date DATE NOT NULL,
  hour INTEGER, -- NULL = daily aggregate
  
  -- Call Metrics
  calls_attempted INTEGER DEFAULT 0,
  calls_answered INTEGER DEFAULT 0,
  calls_voicemail INTEGER DEFAULT 0,
  calls_no_answer INTEGER DEFAULT 0,
  calls_failed INTEGER DEFAULT 0,
  
  -- Outcome Metrics
  interested INTEGER DEFAULT 0,
  not_interested INTEGER DEFAULT 0,
  callbacks_scheduled INTEGER DEFAULT 0,
  orders_placed INTEGER DEFAULT 0,
  demos_scheduled INTEGER DEFAULT 0,
  
  -- Safety Metrics
  opt_outs INTEGER DEFAULT 0,
  escalations INTEGER DEFAULT 0,
  compliance_violations INTEGER DEFAULT 0,
  kill_switch_triggers INTEGER DEFAULT 0,
  
  -- Performance
  avg_call_duration_seconds INTEGER,
  avg_confidence NUMERIC(3,2),
  conversion_rate NUMERIC(5,4),
  opt_out_rate NUMERIC(5,4),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(campaign_id, date, hour)
);

-- 9. SENTINEL CAMPAIGN APPROVALS (Links campaigns to compliance system)
CREATE TABLE public.sentinel_campaign_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.outbound_campaigns(id) ON DELETE CASCADE,
  
  -- Sentinel Evaluation
  sentinel_status TEXT NOT NULL CHECK (sentinel_status IN ('pending', 'approved', 'rejected', 'revoked')),
  evaluation_id UUID REFERENCES public.sentinel_evaluations(id),
  
  -- Checks Performed
  checks_passed JSONB DEFAULT '{}', -- {check_name: true/false}
  drift_detected BOOLEAN DEFAULT false,
  containment_active BOOLEAN DEFAULT false,
  
  -- Approval Details
  approved_at TIMESTAMPTZ,
  approved_by_system BOOLEAN DEFAULT false, -- true = auto-approved, false = manual
  rejection_reason TEXT,
  
  -- Revocation (if sentinel later blocks)
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXES for performance
CREATE INDEX idx_outbound_campaigns_business ON public.outbound_campaigns(business_id);
CREATE INDEX idx_outbound_campaigns_status ON public.outbound_campaigns(status);
CREATE INDEX idx_outbound_campaigns_type ON public.outbound_campaigns(campaign_type);
CREATE INDEX idx_campaign_targets_campaign ON public.outbound_campaign_targets(campaign_id);
CREATE INDEX idx_campaign_targets_status ON public.outbound_campaign_targets(status);
CREATE INDEX idx_campaign_call_logs_campaign ON public.outbound_campaign_call_logs(campaign_id);
CREATE INDEX idx_opt_out_phone ON public.outbound_opt_out_registry(phone_number);
CREATE INDEX idx_campaign_analytics_date ON public.outbound_campaign_analytics(campaign_id, date);

-- ENABLE RLS
ALTER TABLE public.outbound_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_recruitment_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_campaign_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_kill_switches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_opt_out_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_campaign_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_campaign_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentinel_campaign_approvals ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES (Admin/Owner access for campaign management)
CREATE POLICY "Admins can manage outbound campaigns" ON public.outbound_campaigns
  FOR ALL USING (true);

CREATE POLICY "Admins can manage product playbooks" ON public.product_playbooks
  FOR ALL USING (true);

CREATE POLICY "Admins can manage vendor playbooks" ON public.vendor_recruitment_playbooks
  FOR ALL USING (true);

CREATE POLICY "Admins can manage campaign targets" ON public.outbound_campaign_targets
  FOR ALL USING (true);

CREATE POLICY "Admins can manage kill switches" ON public.campaign_kill_switches
  FOR ALL USING (true);

CREATE POLICY "Admins can view opt-out registry" ON public.outbound_opt_out_registry
  FOR ALL USING (true);

CREATE POLICY "Admins can view call logs" ON public.outbound_campaign_call_logs
  FOR ALL USING (true);

CREATE POLICY "Admins can view analytics" ON public.outbound_campaign_analytics
  FOR ALL USING (true);

CREATE POLICY "Admins can view sentinel approvals" ON public.sentinel_campaign_approvals
  FOR ALL USING (true);

-- TRIGGER: Auto-check opt-out registry before allowing call
CREATE OR REPLACE FUNCTION public.check_opt_out_before_call()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this phone number has opted out
  IF EXISTS (
    SELECT 1 FROM public.outbound_opt_out_registry
    WHERE phone_number = NEW.target_phone
    AND is_active = true
    AND (business_id IS NULL OR business_id = (
      SELECT business_id FROM public.outbound_campaigns WHERE id = NEW.campaign_id
    ))
    AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    NEW.status := 'opted_out';
    NEW.opted_out := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_check_opt_out
  BEFORE INSERT ON public.outbound_campaign_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.check_opt_out_before_call();

-- TRIGGER: Immutability for call logs
CREATE OR REPLACE FUNCTION public.enforce_call_log_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_immutable = true THEN
    RAISE EXCEPTION 'Campaign call logs are immutable and cannot be modified';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_call_log_immutable
  BEFORE UPDATE OR DELETE ON public.outbound_campaign_call_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_call_log_immutability();

-- TRIGGER: Auto-trigger kill switch on threshold breach
CREATE OR REPLACE FUNCTION public.auto_trigger_campaign_kill_switch()
RETURNS TRIGGER AS $$
DECLARE
  v_campaign RECORD;
  v_kill_switch RECORD;
  v_opt_out_rate NUMERIC;
  v_escalation_rate NUMERIC;
BEGIN
  -- Only check on certain status changes
  IF NEW.status NOT IN ('opted_out', 'escalated') THEN
    RETURN NEW;
  END IF;
  
  -- Get campaign and its kill switch
  SELECT c.*, ks.auto_trigger_opt_out_rate, ks.auto_trigger_escalation_rate, ks.id as kill_switch_id
  INTO v_campaign
  FROM public.outbound_campaigns c
  LEFT JOIN public.campaign_kill_switches ks ON ks.campaign_id = c.id AND ks.scope = 'campaign'
  WHERE c.id = NEW.campaign_id;
  
  IF v_campaign.kill_switch_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Calculate current rates
  SELECT 
    COUNT(*) FILTER (WHERE opted_out = true)::NUMERIC / NULLIF(COUNT(*), 0),
    COUNT(*) FILTER (WHERE status = 'escalated')::NUMERIC / NULLIF(COUNT(*), 0)
  INTO v_opt_out_rate, v_escalation_rate
  FROM public.outbound_campaign_targets
  WHERE campaign_id = NEW.campaign_id;
  
  -- Check thresholds and trigger if needed
  IF v_opt_out_rate >= COALESCE(v_campaign.auto_trigger_opt_out_rate, 0.10) OR
     v_escalation_rate >= COALESCE(v_campaign.auto_trigger_escalation_rate, 0.20) THEN
    
    -- Trigger kill switch
    UPDATE public.campaign_kill_switches
    SET is_active = false,
        triggered_at = now(),
        trigger_reason = CASE 
          WHEN v_opt_out_rate >= v_campaign.auto_trigger_opt_out_rate THEN 'Opt-out rate exceeded threshold (' || ROUND(v_opt_out_rate * 100) || '%)'
          ELSE 'Escalation rate exceeded threshold (' || ROUND(v_escalation_rate * 100) || '%)'
        END
    WHERE id = v_campaign.kill_switch_id;
    
    -- Halt the campaign
    UPDATE public.outbound_campaigns
    SET status = 'halted',
        kill_switch_triggered = true,
        kill_switch_triggered_at = now(),
        kill_switch_reason = 'Auto-triggered by threshold breach'
    WHERE id = NEW.campaign_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auto_kill_switch
  AFTER UPDATE ON public.outbound_campaign_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_trigger_campaign_kill_switch();

-- Enable realtime for live monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.outbound_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.outbound_campaign_targets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_kill_switches;