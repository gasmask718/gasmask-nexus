
-- Sales Agents
CREATE TABLE public.dsn_sales_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'setter' CHECK (role IN ('setter','closer')),
  category TEXT NOT NULL DEFAULT 'solar' CHECK (category IN ('solar','real_estate','funding')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  performance_score NUMERIC DEFAULT 0,
  close_rate NUMERIC DEFAULT 0,
  total_deals INTEGER DEFAULT 0,
  total_earnings NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.dsn_sales_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dsn_agents_read" ON public.dsn_sales_agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "dsn_agents_insert" ON public.dsn_sales_agents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dsn_agents_update" ON public.dsn_sales_agents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "dsn_agents_delete" ON public.dsn_sales_agents FOR DELETE TO authenticated USING (true);

-- Leads
CREATE TABLE public.dsn_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT DEFAULT 'inbound' CHECK (source IN ('affiliate','inbound','referral','cold_call')),
  category TEXT DEFAULT 'solar' CHECK (category IN ('solar','real_estate','funding')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new','assigned','appointment','closed','paid','lost')),
  assigned_setter_id UUID REFERENCES public.dsn_sales_agents(id),
  assigned_closer_id UUID REFERENCES public.dsn_sales_agents(id),
  lead_score NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.dsn_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dsn_leads_read" ON public.dsn_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "dsn_leads_insert" ON public.dsn_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dsn_leads_update" ON public.dsn_leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "dsn_leads_delete" ON public.dsn_leads FOR DELETE TO authenticated USING (true);

-- Appointments
CREATE TABLE public.dsn_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.dsn_leads(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES public.dsn_sales_agents(id) NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','no_show','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.dsn_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dsn_appts_read" ON public.dsn_appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "dsn_appts_insert" ON public.dsn_appointments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dsn_appts_update" ON public.dsn_appointments FOR UPDATE TO authenticated USING (true);

-- Deals
CREATE TABLE public.dsn_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.dsn_leads(id),
  closer_id UUID REFERENCES public.dsn_sales_agents(id),
  setter_id UUID REFERENCES public.dsn_sales_agents(id),
  value NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','disputed')),
  category TEXT DEFAULT 'solar',
  platform_fee_pct NUMERIC DEFAULT 10,
  notes TEXT,
  closed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.dsn_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dsn_deals_read" ON public.dsn_deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "dsn_deals_insert" ON public.dsn_deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dsn_deals_update" ON public.dsn_deals FOR UPDATE TO authenticated USING (true);

-- Commissions
CREATE TABLE public.dsn_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.dsn_deals(id) ON DELETE CASCADE NOT NULL,
  affiliate_id UUID,
  setter_id UUID REFERENCES public.dsn_sales_agents(id),
  closer_id UUID REFERENCES public.dsn_sales_agents(id),
  deal_value NUMERIC DEFAULT 0,
  platform_fee NUMERIC DEFAULT 0,
  setter_payout NUMERIC DEFAULT 0,
  closer_payout NUMERIC DEFAULT 0,
  affiliate_payout NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','paid')),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.dsn_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dsn_comm_read" ON public.dsn_commissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "dsn_comm_insert" ON public.dsn_commissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dsn_comm_update" ON public.dsn_commissions FOR UPDATE TO authenticated USING (true);

-- Notifications
CREATE TABLE public.dsn_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.dsn_sales_agents(id),
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.dsn_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dsn_notif_read" ON public.dsn_notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "dsn_notif_insert" ON public.dsn_notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dsn_notif_update" ON public.dsn_notifications FOR UPDATE TO authenticated USING (true);

-- Indexes
CREATE INDEX idx_dsn_leads_status ON public.dsn_leads(status);
CREATE INDEX idx_dsn_leads_category ON public.dsn_leads(category);
CREATE INDEX idx_dsn_deals_status ON public.dsn_deals(status);
CREATE INDEX idx_dsn_commissions_status ON public.dsn_commissions(status);
CREATE INDEX idx_dsn_agents_category ON public.dsn_sales_agents(category);
