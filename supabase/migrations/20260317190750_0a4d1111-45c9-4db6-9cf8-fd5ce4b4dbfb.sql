
-- Only create tables that don't exist yet
CREATE TABLE IF NOT EXISTS public.brandaro_client_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_leads_master(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'new',
  satisfaction_score INTEGER DEFAULT 50,
  last_contact_at TIMESTAMPTZ DEFAULT now(),
  next_action TEXT,
  assigned_manager TEXT,
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.brandaro_client_lifecycle ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Auth users manage client lifecycle" ON public.brandaro_client_lifecycle FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.brandaro_client_touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_leads_master(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL,
  message TEXT,
  channel TEXT DEFAULT 'sms',
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.brandaro_client_touchpoints ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Auth users manage client touchpoints" ON public.brandaro_client_touchpoints FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.brandaro_client_value (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.brandaro_leads_master(id) ON DELETE CASCADE UNIQUE,
  total_spent NUMERIC DEFAULT 0,
  monthly_value NUMERIC DEFAULT 0,
  upsell_probability NUMERIC DEFAULT 0,
  churn_risk NUMERIC DEFAULT 0,
  client_grade TEXT DEFAULT 'C',
  months_active INTEGER DEFAULT 0,
  last_payment_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.brandaro_client_value ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Auth users manage client value" ON public.brandaro_client_value FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
