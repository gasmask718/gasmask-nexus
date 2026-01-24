-- Enforced Call Resolution Schema
-- Add escalation rules per business

-- Auto-escalation rules table
CREATE TABLE public.call_escalation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  rule_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- 'missed_call', 'voicemail_unresolved', 'repeat_caller', 'after_hours'
  trigger_threshold_minutes INTEGER DEFAULT 30,
  action_type TEXT NOT NULL, -- 'create_task', 'notify_admin', 'escalate', 'auto_sms'
  action_target_role TEXT,
  action_target_user_id UUID REFERENCES public.profiles(id),
  auto_sms_template TEXT,
  is_enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add resolution tracking fields to call_followups
ALTER TABLE public.call_followups 
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalated_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS resolution_type TEXT, -- 'callback_made', 'sms_sent', 'resolved_other', 'escalated'
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

-- Add AI assist fields to voicemails
ALTER TABLE public.voicemails
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_intent TEXT, -- 'sales', 'support', 'complaint', 'inquiry', 'urgent'
  ADD COLUMN IF NOT EXISTS ai_priority_score INTEGER,
  ADD COLUMN IF NOT EXISTS ai_suggested_action TEXT,
  ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMP WITH TIME ZONE;

-- Add AI assist fields to call_outcomes
ALTER TABLE public.call_outcomes
  ADD COLUMN IF NOT EXISTS resolution_status TEXT DEFAULT 'unresolved', -- 'unresolved', 'acknowledged', 'in_progress', 'resolved', 'escalated'
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS sla_met BOOLEAN;

-- Go-live readiness tracking per business
CREATE TABLE public.business_call_readiness (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) UNIQUE NOT NULL,
  caller_id_configured BOOLEAN DEFAULT false,
  business_hours_configured BOOLEAN DEFAULT false,
  after_hours_configured BOOLEAN DEFAULT false,
  callable_users_configured BOOLEAN DEFAULT false,
  inbound_routes_configured BOOLEAN DEFAULT false,
  voicemail_configured BOOLEAN DEFAULT false,
  test_ring_passed BOOLEAN DEFAULT false,
  test_ring_after_hours_passed BOOLEAN DEFAULT false,
  ai_auto_answer_enabled BOOLEAN DEFAULT false,
  ai_auto_answer_blocked_reason TEXT,
  last_checked_at TIMESTAMP WITH TIME ZONE,
  go_live_approved_at TIMESTAMP WITH TIME ZONE,
  go_live_approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.call_escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_call_readiness ENABLE ROW LEVEL SECURITY;

-- Escalation rules policies
CREATE POLICY "Users can view escalation rules for their business"
  ON public.call_escalation_rules
  FOR SELECT
  USING (true);

CREATE POLICY "Users can manage escalation rules"
  ON public.call_escalation_rules
  FOR ALL
  USING (true);

-- Call readiness policies
CREATE POLICY "Users can view call readiness for their business"
  ON public.business_call_readiness
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update call readiness"
  ON public.business_call_readiness
  FOR ALL
  USING (true);

-- Add indexes
CREATE INDEX idx_call_escalation_rules_business ON public.call_escalation_rules(business_id);
CREATE INDEX idx_call_escalation_rules_trigger ON public.call_escalation_rules(trigger_type);
CREATE INDEX idx_call_followups_sla ON public.call_followups(sla_deadline) WHERE status = 'pending';
CREATE INDEX idx_call_outcomes_resolution ON public.call_outcomes(resolution_status) WHERE resolution_status != 'resolved';
CREATE INDEX idx_voicemails_ai_intent ON public.voicemails(ai_intent) WHERE ai_intent IS NOT NULL;