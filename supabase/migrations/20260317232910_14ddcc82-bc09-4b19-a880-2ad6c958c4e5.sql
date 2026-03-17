
-- Track autonomous execution actions and contact limits
CREATE TABLE public.brandaro_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  lead_id text,
  phone text,
  action_type text NOT NULL, -- ai_call, sms, payment_link, ai_agent
  trigger_source text, -- new_lead, hot_lead, stale_lead, followup, payment_intent
  personality_used text,
  channel text DEFAULT 'call',
  result text DEFAULT 'pending', -- pending, success, failed, no_answer, voicemail
  provider_sid text,
  error_message text,
  revenue_attributed numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Contact limits / cooldown tracking per lead
CREATE TABLE public.brandaro_contact_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text NOT NULL UNIQUE,
  daily_contacts int DEFAULT 0,
  total_contacts int DEFAULT 0,
  last_contacted_at timestamptz,
  next_allowed_at timestamptz,
  cooldown_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Conversation memory per lead
CREATE TABLE public.brandaro_lead_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text NOT NULL,
  memory_type text NOT NULL, -- objection, interest, preference, context
  memory_key text NOT NULL,
  memory_value text,
  confidence numeric DEFAULT 0.5,
  source text, -- call, sms, manual
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_lead_memory_lead ON public.brandaro_lead_memory(lead_id);

ALTER TABLE public.brandaro_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_contact_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_lead_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage execution_log" ON public.brandaro_execution_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage contact_limits" ON public.brandaro_contact_limits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users manage lead_memory" ON public.brandaro_lead_memory FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.brandaro_execution_log;
