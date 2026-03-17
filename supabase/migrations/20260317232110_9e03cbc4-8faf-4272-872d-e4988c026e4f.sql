
-- Automation rules/triggers configuration
CREATE TABLE public.brandaro_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  name text NOT NULL,
  trigger_type text NOT NULL, -- new_lead, missed_call, hot_lead, stale_lead, payment_intent, interest_signal, re_engagement
  conditions jsonb DEFAULT '{}',
  actions jsonb DEFAULT '[]', -- array of actions: assign_va, schedule_call, send_message, change_personality, escalate, send_payment_link
  follow_up_sequence jsonb DEFAULT '[]', -- day-based sequence steps
  personality_id uuid,
  is_active boolean DEFAULT true,
  priority int DEFAULT 5,
  executions_count int DEFAULT 0,
  conversions_count int DEFAULT 0,
  revenue_generated numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Automation execution log
CREATE TABLE public.brandaro_automation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES public.brandaro_automations(id),
  business_id uuid REFERENCES public.businesses(id),
  trigger_type text NOT NULL,
  lead_id text,
  action_taken text NOT NULL,
  action_details jsonb DEFAULT '{}',
  result text DEFAULT 'pending', -- pending, success, failed, skipped
  error_message text,
  personality_used text,
  created_at timestamptz DEFAULT now()
);

-- Follow-up queue for automated sequences
CREATE TABLE public.brandaro_followup_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  automation_id uuid REFERENCES public.brandaro_automations(id),
  lead_id text NOT NULL,
  step_number int DEFAULT 0,
  scheduled_at timestamptz NOT NULL,
  executed_at timestamptz,
  message_template text,
  personality_id uuid,
  channel text DEFAULT 'call', -- call, sms, email
  status text DEFAULT 'pending', -- pending, executed, skipped, cancelled
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brandaro_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_automation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_followup_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Users can manage automations" ON public.brandaro_automations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Users can view automation logs" ON public.brandaro_automation_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Users can manage followup queue" ON public.brandaro_followup_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime for automation log
ALTER PUBLICATION supabase_realtime ADD TABLE public.brandaro_automation_log;

-- Index for fast querying
CREATE INDEX idx_followup_queue_scheduled ON public.brandaro_followup_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_automation_log_created ON public.brandaro_automation_log(created_at DESC);
