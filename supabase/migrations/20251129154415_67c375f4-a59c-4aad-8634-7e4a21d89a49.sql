-- Create ai_follow_up_log table for tracking automated follow-up actions
CREATE TABLE public.ai_follow_up_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  brand TEXT,
  region TEXT,
  action_taken TEXT NOT NULL,
  action_category TEXT, -- 'invoice', 'store', 'inventory', 'driver', 'ambassador'
  result TEXT, -- 'success', 'failed', 'pending', 'escalated'
  message_sent TEXT,
  next_follow_up_date DATE,
  escalated BOOLEAN DEFAULT false,
  escalation_level INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by TEXT DEFAULT 'system'
);

-- Create ai_follow_up_settings table for configurable rules
CREATE TABLE public.ai_follow_up_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL UNIQUE, -- 'invoice', 'store', 'inventory', 'driver', 'ambassador'
  settings JSONB NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ai_daily_briefings table for storing generated briefings
CREATE TABLE public.ai_daily_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_type TEXT NOT NULL, -- 'morning', 'evening'
  briefing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  brand TEXT,
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_follow_up_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_follow_up_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_daily_briefings ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_follow_up_log
CREATE POLICY "Allow authenticated users to view follow-up logs"
ON public.ai_follow_up_log FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow system to insert follow-up logs"
ON public.ai_follow_up_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS policies for ai_follow_up_settings
CREATE POLICY "Allow authenticated users to view settings"
ON public.ai_follow_up_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to manage settings"
ON public.ai_follow_up_settings FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- RLS policies for ai_daily_briefings
CREATE POLICY "Allow authenticated users to view briefings"
ON public.ai_daily_briefings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow system to insert briefings"
ON public.ai_daily_briefings FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_follow_up_log_entity ON public.ai_follow_up_log(entity_type, entity_id);
CREATE INDEX idx_follow_up_log_created ON public.ai_follow_up_log(created_at DESC);
CREATE INDEX idx_follow_up_log_category ON public.ai_follow_up_log(action_category);
CREATE INDEX idx_daily_briefings_date ON public.ai_daily_briefings(briefing_date, briefing_type);

-- Insert default settings
INSERT INTO public.ai_follow_up_settings (category, settings) VALUES
('invoice', '{
  "day1_message": "Hi! Just a friendly reminder that your invoice is due. Let us know if you have any questions!",
  "day5_message": "Following up on your outstanding invoice. Please process payment at your earliest convenience.",
  "day10_message": "Your invoice is now overdue. Please make payment immediately to avoid service interruption.",
  "day15_message": "URGENT: Your account is significantly overdue. Please contact us immediately.",
  "max_reminders": 4,
  "escalation_after_days": 15,
  "auto_reminder_enabled": true
}'),
('store', '{
  "churn_threshold_days": 14,
  "critical_churn_days": 30,
  "auto_reminder_message": "Hey! We noticed we havent stopped by in a while. Were planning visits this week - need anything?",
  "auto_route_enabled": true,
  "recovery_message": "We miss you! Let us know if theres anything we can do to help."
}'),
('inventory', '{
  "low_stock_threshold_percent": 25,
  "auto_reorder_enabled": false,
  "notify_supplier": true,
  "reorder_lead_days": 3
}'),
('driver', '{
  "late_threshold_minutes": 30,
  "missed_stop_threshold": 2,
  "auto_reassign_enabled": false,
  "alert_operations": true,
  "performance_review_days": 7
}'),
('ambassador', '{
  "inactivity_threshold_days": 14,
  "critical_inactivity_days": 30,
  "motivational_message": "Keep pushing! Your next commission could be right around the corner.",
  "weekly_tips_enabled": true,
  "auto_reactivation_enabled": true
}')
ON CONFLICT (category) DO NOTHING;