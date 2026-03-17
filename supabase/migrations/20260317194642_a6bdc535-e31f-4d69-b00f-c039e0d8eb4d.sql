
-- Add optimization/scaling columns to ads tables
ALTER TABLE public.brandaro_internal_ads 
  ADD COLUMN IF NOT EXISTS kill_switch BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS performance_score NUMERIC(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scaling_level INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS target_cpl NUMERIC(8,2) DEFAULT 25;

ALTER TABLE public.brandaro_client_ads 
  ADD COLUMN IF NOT EXISTS kill_switch BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS performance_score NUMERIC(6,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scaling_level INTEGER DEFAULT 1;

-- Add lead quality score to ad_leads
ALTER TABLE public.brandaro_ad_leads
  ADD COLUMN IF NOT EXISTS lead_quality_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_touch_source TEXT,
  ADD COLUMN IF NOT EXISTS last_touch_source TEXT,
  ADD COLUMN IF NOT EXISTS first_touch_campaign TEXT,
  ADD COLUMN IF NOT EXISTS last_touch_campaign TEXT,
  ADD COLUMN IF NOT EXISTS source_confidence NUMERIC(3,2) DEFAULT 1.0;

-- Add conversion tracking to seo_pages
ALTER TABLE public.brandaro_seo_pages
  ADD COLUMN IF NOT EXISTS leads_generated INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC(5,2) DEFAULT 0;

-- Create optimization recommendations table
CREATE TABLE IF NOT EXISTS public.brandaro_optimization_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engine TEXT NOT NULL, -- 'ads', 'seo', 'retention', 'global'
  action_type TEXT NOT NULL, -- 'scale', 'pause', 'expand', 'alert', 'duplicate'
  target_id UUID,
  target_name TEXT,
  recommendation TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  auto_executed BOOLEAN DEFAULT false,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brandaro_optimization_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth manage optimization_log" ON public.brandaro_optimization_log;
CREATE POLICY "Auth manage optimization_log" ON public.brandaro_optimization_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_optimization_log_engine ON public.brandaro_optimization_log(engine);
CREATE INDEX IF NOT EXISTS idx_optimization_log_created ON public.brandaro_optimization_log(created_at);
