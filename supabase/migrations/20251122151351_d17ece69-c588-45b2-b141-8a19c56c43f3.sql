-- Call Center Cloud Department Tables

-- Phone numbers management
CREATE TABLE IF NOT EXISTS call_center_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('call', 'sms', 'both')),
  default_ai_agent_id UUID,
  default_routing_rules JSONB DEFAULT '[]'::jsonb,
  voicemail_greeting_url TEXT,
  after_hours_forwarding TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- AI Agents configuration
CREATE TABLE IF NOT EXISTS call_center_ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  personality TEXT,
  knowledge_base JSONB DEFAULT '{}'::jsonb,
  response_scripts JSONB DEFAULT '[]'::jsonb,
  allowed_actions JSONB DEFAULT '[]'::jsonb,
  escalation_rules JSONB DEFAULT '[]'::jsonb,
  voice_selection TEXT DEFAULT 'neutral',
  greeting_message TEXT,
  compliance_version TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Call logs
CREATE TABLE IF NOT EXISTS call_center_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id UUID REFERENCES call_center_phone_numbers(id),
  caller_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  duration INTEGER DEFAULT 0,
  answered_by TEXT,
  ai_agent_id UUID REFERENCES call_center_ai_agents(id),
  recording_url TEXT,
  transcript TEXT,
  summary TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  emotion_detected TEXT,
  sentiment_score INTEGER,
  assigned_department TEXT,
  outcome TEXT,
  business_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Call recordings storage
CREATE TABLE IF NOT EXISTS call_center_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id UUID REFERENCES call_center_logs(id) ON DELETE CASCADE,
  recording_url TEXT NOT NULL,
  duration INTEGER,
  file_size BIGINT,
  transcription_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SMS/Text messages
CREATE TABLE IF NOT EXISTS call_center_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id UUID REFERENCES call_center_phone_numbers(id),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  message_body TEXT,
  media_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT DEFAULT 'sent',
  ai_reply BOOLEAN DEFAULT false,
  contact_id UUID,
  business_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Email center
CREATE TABLE IF NOT EXISTS call_center_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  category TEXT,
  ai_handled BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'normal',
  contact_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Smart routing rules
CREATE TABLE IF NOT EXISTS call_center_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business_name TEXT,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Call tasks
CREATE TABLE IF NOT EXISTS call_center_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id UUID REFERENCES call_center_logs(id),
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES profiles(id),
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  business_name TEXT,
  created_by_ai BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Outbound dialer campaigns
CREATE TABLE IF NOT EXISTS call_center_dialer_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  ai_agent_id UUID REFERENCES call_center_ai_agents(id),
  phone_number_id UUID REFERENCES call_center_phone_numbers(id),
  target_list JSONB DEFAULT '[]'::jsonb,
  call_script TEXT,
  voicemail_drop_url TEXT,
  retry_logic JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  calls_made INTEGER DEFAULT 0,
  calls_connected INTEGER DEFAULT 0,
  appointments_set INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Red flag alerts
CREATE TABLE IF NOT EXISTS call_center_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id UUID REFERENCES call_center_logs(id),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  keywords_detected TEXT[] DEFAULT ARRAY[]::TEXT[],
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES profiles(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Call analytics
CREATE TABLE IF NOT EXISTS call_center_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_calls INTEGER DEFAULT 0,
  answered_calls INTEGER DEFAULT 0,
  missed_calls INTEGER DEFAULT 0,
  avg_duration INTEGER DEFAULT 0,
  conversion_rate NUMERIC DEFAULT 0,
  revenue_generated NUMERIC DEFAULT 0,
  lead_quality_score INTEGER DEFAULT 0,
  metrics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE call_center_phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_dialer_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_center_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Admin access)
CREATE POLICY "Admins manage phone numbers" ON call_center_phone_numbers FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage AI agents" ON call_center_ai_agents FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view call logs" ON call_center_logs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view recordings" ON call_center_recordings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view messages" ON call_center_messages FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view emails" ON call_center_emails FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage routing" ON call_center_routing_rules FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage tasks" ON call_center_tasks FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage campaigns" ON call_center_dialer_campaigns FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view alerts" ON call_center_alerts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins view analytics" ON call_center_analytics FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert data
CREATE POLICY "System can insert call logs" ON call_center_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "System can insert recordings" ON call_center_recordings FOR INSERT WITH CHECK (true);
CREATE POLICY "System can insert messages" ON call_center_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "System can insert emails" ON call_center_emails FOR INSERT WITH CHECK (true);
CREATE POLICY "System can insert tasks" ON call_center_tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "System can insert alerts" ON call_center_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "System can upsert analytics" ON call_center_analytics FOR ALL WITH CHECK (true);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_call_center_phone_numbers_updated_at BEFORE UPDATE ON call_center_phone_numbers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_call_center_ai_agents_updated_at BEFORE UPDATE ON call_center_ai_agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_call_center_routing_rules_updated_at BEFORE UPDATE ON call_center_routing_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_call_center_tasks_updated_at BEFORE UPDATE ON call_center_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_call_center_dialer_campaigns_updated_at BEFORE UPDATE ON call_center_dialer_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for call recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('call-recordings', 'call-recordings', false) ON CONFLICT (id) DO NOTHING;

-- Storage policies for call recordings
CREATE POLICY "Admins can manage recordings" ON storage.objects FOR ALL USING (
  bucket_id = 'call-recordings' AND has_role(auth.uid(), 'admin'::app_role)
);

-- Seed default AI agents for each business
INSERT INTO call_center_ai_agents (name, business_name, personality, greeting_message, voice_selection) VALUES
('GasMask Support AI', 'GasMask', 'Professional and helpful retail support', 'Thank you for calling GasMask. How can I help you today?', 'professional'),
('GasMask Wholesale AI', 'GasMask Wholesale', 'Business-focused wholesale expert', 'Welcome to GasMask Wholesale. How can I assist your business today?', 'professional'),
('Hot Mama AI', 'Hot Mama', 'Friendly and welcoming', 'Hey there! Thanks for calling Hot Mama. What can I do for you?', 'warm'),
('TopTier Dispatch AI', 'TopTier Transport', 'Efficient logistics coordinator', 'TopTier Transport dispatch. How can I help with your delivery?', 'efficient'),
('PlayBoxxx Support AI', 'PlayBoxxx', 'Discreet and professional', 'Thank you for calling. How may I assist you today?', 'discreet'),
('Real Estate Acquisition AI', 'Real Estate', 'Expert property acquisitions specialist', 'Thank you for calling. Are you looking to sell your property?', 'expert'),
('POD Design AI', 'POD Department', 'Creative design consultant', 'POD Design Studio. Let''s talk about your design needs.', 'creative'),
('Funding & Grants AI', 'Funding', 'Financial expert advisor', 'Funding department. How can I help you access capital today?', 'authoritative'),
('Cleaning Company AI', 'Cleaning', 'Friendly service coordinator', 'Thank you for calling our cleaning service. How can we help?', 'friendly')
ON CONFLICT DO NOTHING;