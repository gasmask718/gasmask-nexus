-- 1. bland_leads
CREATE TABLE public.bland_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID,
  name TEXT,
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','interested','callback','not-interested')),
  pain_points TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bland_leads_phone ON public.bland_leads(phone_number);
CREATE INDEX idx_bland_leads_status ON public.bland_leads(status);

ALTER TABLE public.bland_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read bland_leads" ON public.bland_leads
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert bland_leads" ON public.bland_leads
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update bland_leads" ON public.bland_leads
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Service role full bland_leads" ON public.bland_leads
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. bland_call_logs
CREATE TABLE public.bland_call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.bland_leads(id) ON DELETE CASCADE,
  agent_type TEXT,
  call_id TEXT,
  transcript TEXT,
  recording_url TEXT,
  call_outcome TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bland_call_logs_lead ON public.bland_call_logs(lead_id);
CREATE INDEX idx_bland_call_logs_call_id ON public.bland_call_logs(call_id);

ALTER TABLE public.bland_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read bland_call_logs" ON public.bland_call_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert bland_call_logs" ON public.bland_call_logs
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Service role full bland_call_logs" ON public.bland_call_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. bland_agent_webhooks
CREATE TABLE public.bland_agent_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  default_voice TEXT DEFAULT 'maya',
  default_prompt TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bland_agent_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read bland_agent_webhooks" ON public.bland_agent_webhooks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated update bland_agent_webhooks" ON public.bland_agent_webhooks
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated insert bland_agent_webhooks" ON public.bland_agent_webhooks
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Service role full bland_agent_webhooks" ON public.bland_agent_webhooks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed agents
INSERT INTO public.bland_agent_webhooks (agent_name, agent_type, webhook_url, description, default_prompt, sort_order) VALUES
  ('Sales-Outreach', 'sales-outreach',
   'https://qalaaroashbggynpvqct.supabase.co/functions/v1/bland-agent-webhook',
   'Cold outbound sales calls to new prospects.',
   'You are a friendly sales rep calling a prospect. Introduce yourself, qualify interest, and book a follow-up if interested.', 1),
  ('Follow-up Call', 'follow-up',
   'https://qalaaroashbggynpvqct.supabase.co/functions/v1/bland-agent-webhook',
   'Follow up on a previous conversation or quote.',
   'You are calling to follow up on a previous conversation. Reference prior interest, answer questions, and move toward a close.', 2),
  ('Reactivation / Win-back', 'reactivation',
   'https://qalaaroashbggynpvqct.supabase.co/functions/v1/bland-agent-webhook',
   'Win-back inactive accounts with a fresh offer.',
   'You are calling a lapsed customer. Reintroduce the brand, share what is new, and offer a reactivation incentive.', 3),
  ('Inventory Check', 'inventory-check',
   'https://qalaaroashbggynpvqct.supabase.co/functions/v1/bland-agent-webhook',
   'Verify on-shelf stock and reorder needs with stores.',
   'You are calling a store to check current inventory levels and ask if they need to reorder. Be quick and professional.', 4);

-- 4. dialer_campaigns columns
ALTER TABLE public.dialer_campaigns
  ADD COLUMN IF NOT EXISTS agent_provider TEXT DEFAULT 'elevenlabs',
  ADD COLUMN IF NOT EXISTS bland_agent_id UUID;

-- updated_at triggers
CREATE TRIGGER trg_bland_leads_updated_at
  BEFORE UPDATE ON public.bland_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_bland_agent_webhooks_updated_at
  BEFORE UPDATE ON public.bland_agent_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();