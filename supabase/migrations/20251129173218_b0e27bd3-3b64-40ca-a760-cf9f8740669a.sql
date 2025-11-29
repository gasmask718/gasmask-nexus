-- Create advisor_triggers table for autonomous instinct detection
CREATE TABLE public.advisor_triggers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('risk', 'opportunity', 'task', 'action')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL,
  condition_detected TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  recommended_action TEXT,
  auto_generated_task BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'processing', 'resolved', 'dismissed')),
  related_entity_type TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.advisor_triggers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view triggers"
  ON public.advisor_triggers FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert triggers"
  ON public.advisor_triggers FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update triggers"
  ON public.advisor_triggers FOR UPDATE
  TO authenticated USING (true);

-- Indexes for performance
CREATE INDEX idx_advisor_triggers_status ON public.advisor_triggers(status);
CREATE INDEX idx_advisor_triggers_severity ON public.advisor_triggers(severity);
CREATE INDEX idx_advisor_triggers_category ON public.advisor_triggers(category);
CREATE INDEX idx_advisor_triggers_created_at ON public.advisor_triggers(created_at DESC);

-- Create autopilot_settings table
CREATE TABLE public.autopilot_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  autopilot_enabled BOOLEAN DEFAULT false,
  auto_create_tasks BOOLEAN DEFAULT true,
  auto_assign_routes BOOLEAN DEFAULT false,
  auto_send_communications BOOLEAN DEFAULT false,
  auto_financial_corrections BOOLEAN DEFAULT false,
  severity_threshold TEXT DEFAULT 'high' CHECK (severity_threshold IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.autopilot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their autopilot settings"
  ON public.autopilot_settings FOR ALL
  TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);

-- Add trigger for updated_at
CREATE TRIGGER update_autopilot_settings_timestamp
  BEFORE UPDATE ON public.autopilot_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();