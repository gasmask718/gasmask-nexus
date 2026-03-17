
-- Lead Master table for automated lead generation
CREATE TABLE IF NOT EXISTS public.brandaro_leads_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  website TEXT,
  industry TEXT,
  location TEXT,
  has_website BOOLEAN DEFAULT true,
  source TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'new',
  intent_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Call queue for auto-dialing
CREATE TABLE IF NOT EXISTS public.brandaro_call_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_leads_master(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending',
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ DEFAULT now(),
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Call log
CREATE TABLE IF NOT EXISTS public.brandaro_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_leads_master(id) ON DELETE CASCADE NOT NULL,
  call_status TEXT DEFAULT 'initiated',
  duration_seconds INTEGER,
  transcript TEXT,
  outcome TEXT,
  ai_handled BOOLEAN DEFAULT false,
  caller_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI conversation tracking
CREATE TABLE IF NOT EXISTS public.brandaro_ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_leads_master(id) ON DELETE CASCADE NOT NULL,
  call_id UUID REFERENCES public.brandaro_calls(id) ON DELETE SET NULL,
  transcript TEXT,
  intent_detected TEXT,
  objection_type TEXT,
  close_attempted BOOLEAN DEFAULT false,
  result TEXT,
  handoff_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Followup automation
CREATE TABLE IF NOT EXISTS public.brandaro_followup_automation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.brandaro_leads_master(id) ON DELETE CASCADE NOT NULL,
  step INTEGER DEFAULT 1,
  scheduled_time TIMESTAMPTZ NOT NULL,
  message TEXT NOT NULL,
  channel TEXT DEFAULT 'sms',
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance AI
CREATE TABLE IF NOT EXISTS public.brandaro_performance_ai (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_version TEXT,
  industry TEXT,
  close_rate NUMERIC(5,2),
  revenue_generated NUMERIC(12,2) DEFAULT 0,
  total_calls INTEGER DEFAULT 0,
  total_closes INTEGER DEFAULT 0,
  avg_deal_size NUMERIC(10,2),
  period TEXT DEFAULT 'monthly',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brandaro_leads_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_call_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_followup_automation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_performance_ai ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_manage_leads_master" ON public.brandaro_leads_master FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_call_queue" ON public.brandaro_call_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_calls" ON public.brandaro_calls FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_ai_conversations" ON public.brandaro_ai_conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_followup_automation" ON public.brandaro_followup_automation FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_manage_performance_ai" ON public.brandaro_performance_ai FOR ALL TO authenticated USING (true) WITH CHECK (true);
