-- Add budget columns to scout config
ALTER TABLE public.brandaro_scout_config
  ADD COLUMN IF NOT EXISTS daily_spend_limit NUMERIC(8,2) DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS monthly_spend_limit NUMERIC(8,2) DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS cost_per_search NUMERIC(8,6) DEFAULT 0.012,
  ADD COLUMN IF NOT EXISTS daily_spend_today NUMERIC(8,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_spend_this_month NUMERIC(8,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spend_reset_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS monthly_reset_date DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE,
  ADD COLUMN IF NOT EXISTS budget_alert_threshold NUMERIC(5,2) DEFAULT 80,
  ADD COLUMN IF NOT EXISTS budget_paused_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_spent_all_time NUMERIC(10,6) DEFAULT 0;

-- Add cost column to runs
ALTER TABLE public.brandaro_scout_runs
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(8,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stop_reason TEXT;

-- Spend tracking log
CREATE TABLE IF NOT EXISTS public.brandaro_scout_spend_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID REFERENCES public.brandaro_scout_runs(id),
  action TEXT NOT NULL,
  cost NUMERIC(8,6) NOT NULL,
  cumulative_today NUMERIC(8,6),
  cumulative_month NUMERIC(8,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.brandaro_scout_spend_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to spend log" ON public.brandaro_scout_spend_log FOR ALL USING (true) WITH CHECK (true);