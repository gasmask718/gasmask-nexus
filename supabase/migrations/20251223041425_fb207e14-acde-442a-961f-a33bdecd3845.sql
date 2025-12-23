-- =====================================================
-- COMMUNICATION SYSTEMS WORK OWNERSHIP UPGRADE
-- Add ownership columns to existing tables
-- =====================================================

-- Add work ownership columns to communication_messages
ALTER TABLE public.communication_messages 
ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS due_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS escalated_to UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS escalation_reason TEXT,
ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS snooze_reason TEXT,
ADD COLUMN IF NOT EXISTS actor_type TEXT DEFAULT 'human';

-- Create call_dispositions table
CREATE TABLE IF NOT EXISTS public.call_dispositions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_log_id TEXT NOT NULL,
  business_name TEXT,
  disposition_code TEXT NOT NULL,
  reason_category TEXT,
  follow_up_required BOOLEAN NOT NULL DEFAULT false,
  follow_up_type TEXT,
  follow_up_scheduled_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  recording_consent_given BOOLEAN,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create escalation_rules table
CREATE TABLE IF NOT EXISTS public.escalation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT,
  name TEXT NOT NULL,
  description TEXT,
  channel_type TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}',
  escalate_to_user_id UUID REFERENCES public.profiles(id),
  escalate_to_role TEXT,
  notification_method TEXT NOT NULL DEFAULT 'in_app',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create communication_delivery_status table
CREATE TABLE IF NOT EXISTS public.communication_delivery_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT,
  source_id TEXT NOT NULL,
  source_table TEXT NOT NULL,
  channel_type TEXT NOT NULL,
  status TEXT NOT NULL,
  failure_reason TEXT,
  failure_code TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create communication_compliance_logs table
CREATE TABLE IF NOT EXISTS public.communication_compliance_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT,
  contact_id UUID,
  channel_type TEXT NOT NULL,
  compliance_type TEXT NOT NULL,
  action TEXT NOT NULL,
  source TEXT,
  evidence TEXT,
  logged_by UUID REFERENCES public.profiles(id),
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_dispositions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_delivery_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_compliance_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "call_dispositions_all" ON public.call_dispositions FOR ALL USING (true);
CREATE POLICY "escalation_rules_all" ON public.escalation_rules FOR ALL USING (true);
CREATE POLICY "comm_delivery_all" ON public.communication_delivery_status FOR ALL USING (true);
CREATE POLICY "comm_compliance_all" ON public.communication_compliance_logs FOR ALL USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_owner ON public.communication_messages(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.communication_messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_priority ON public.communication_messages(priority);
CREATE INDEX IF NOT EXISTS idx_dispositions_call ON public.call_dispositions(call_log_id);
CREATE INDEX IF NOT EXISTS idx_escalation_business ON public.escalation_rules(business_name);
CREATE INDEX IF NOT EXISTS idx_delivery_source ON public.communication_delivery_status(source_id);
CREATE INDEX IF NOT EXISTS idx_compliance_contact ON public.communication_compliance_logs(contact_id);