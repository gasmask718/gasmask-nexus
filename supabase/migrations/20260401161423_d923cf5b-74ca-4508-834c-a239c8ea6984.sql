
-- DC Agents table
CREATE TABLE IF NOT EXISTS public.dc_agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  agent_id TEXT UNIQUE,
  voice_id TEXT,
  agent_type TEXT,
  system_prompt TEXT,
  first_message TEXT,
  is_active BOOLEAN DEFAULT true,
  total_calls INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dc_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view DC agents"
ON public.dc_agents FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage DC agents"
ON public.dc_agents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- DC Call Logs table
CREATE TABLE IF NOT EXISTS public.dc_call_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_sid TEXT UNIQUE,
  from_number TEXT,
  to_number TEXT,
  direction TEXT,
  status TEXT DEFAULT 'initiated',
  agent_id TEXT,
  agent_type TEXT,
  lead_id UUID,
  lead_name TEXT,
  campaign_id UUID,
  duration_seconds INTEGER,
  answered_by TEXT,
  outcome TEXT,
  recording_url TEXT,
  transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dc_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view DC call logs"
ON public.dc_call_logs FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage DC call logs"
ON public.dc_call_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- DC Campaigns table
CREATE TABLE IF NOT EXISTS public.dc_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  agent_type TEXT,
  status TEXT DEFAULT 'draft',
  total_leads INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,
  connected INTEGER DEFAULT 0,
  voicemails_skipped INTEGER DEFAULT 0,
  appointments_set INTEGER DEFAULT 0,
  calls_per_hour INTEGER DEFAULT 20,
  max_attempts INTEGER DEFAULT 2,
  start_time TEXT DEFAULT '09:00',
  end_time TEXT DEFAULT '20:00',
  active_days JSONB DEFAULT '["Mon","Tue","Wed","Thu","Fri"]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dc_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view DC campaigns"
ON public.dc_campaigns FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage DC campaigns"
ON public.dc_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime for live call feed
ALTER PUBLICATION supabase_realtime ADD TABLE public.dc_call_logs;
