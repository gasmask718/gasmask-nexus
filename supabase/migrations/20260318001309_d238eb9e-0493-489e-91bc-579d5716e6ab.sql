
CREATE TABLE public.brandaro_budget_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,
  campaign_id TEXT,
  campaign_name TEXT,
  allocated_amount NUMERIC DEFAULT 0,
  spent_amount NUMERIC DEFAULT 0,
  revenue_attributed NUMERIC DEFAULT 0,
  roi_pct NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  scaling_action TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.brandaro_scaling_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  target_campaign TEXT,
  target_channel TEXT,
  previous_budget NUMERIC DEFAULT 0,
  new_budget NUMERIC DEFAULT 0,
  reason TEXT,
  roi_at_decision NUMERIC DEFAULT 0,
  conversion_rate_at_decision NUMERIC DEFAULT 0,
  automated BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.brandaro_reinvestment_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_number INTEGER DEFAULT 1,
  total_revenue NUMERIC DEFAULT 0,
  reinvestment_pct NUMERIC DEFAULT 30,
  reinvestment_amount NUMERIC DEFAULT 0,
  allocations JSONB DEFAULT '[]',
  campaigns_scaled INTEGER DEFAULT 0,
  campaigns_killed INTEGER DEFAULT 0,
  campaigns_created INTEGER DEFAULT 0,
  net_roi NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.brandaro_autopilot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reinvestment_pct NUMERIC DEFAULT 30,
  min_roi_to_scale NUMERIC DEFAULT 100,
  max_budget_per_campaign NUMERIC DEFAULT 5000,
  stop_loss_threshold NUMERIC DEFAULT -20,
  anomaly_detection_enabled BOOLEAN DEFAULT true,
  auto_kill_enabled BOOLEAN DEFAULT true,
  auto_scale_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_budget_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_scaling_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_reinvestment_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brandaro_autopilot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.brandaro_budget_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.brandaro_scaling_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.brandaro_reinvestment_cycles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.brandaro_autopilot_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
