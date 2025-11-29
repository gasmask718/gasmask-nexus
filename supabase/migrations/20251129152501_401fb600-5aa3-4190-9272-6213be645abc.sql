-- Create ai_risk_insights table
CREATE TABLE IF NOT EXISTS public.ai_risk_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  brand TEXT,
  region TEXT,
  risk_type TEXT NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  headline TEXT NOT NULL,
  details TEXT,
  recommended_action TEXT,
  source_data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create ai_kpi_snapshots table
CREATE TABLE IF NOT EXISTS public.ai_kpi_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  brand TEXT,
  region TEXT,
  total_stores INTEGER DEFAULT 0,
  active_stores INTEGER DEFAULT 0,
  inactive_stores INTEGER DEFAULT 0,
  total_invoices INTEGER DEFAULT 0,
  unpaid_invoices INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  deliveries_today INTEGER DEFAULT 0,
  low_stock_items INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_risk_insights_entity ON public.ai_risk_insights(entity_type, entity_id, risk_type, status);
CREATE INDEX IF NOT EXISTS idx_risk_insights_level ON public.ai_risk_insights(risk_level, status);
CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_date ON public.ai_kpi_snapshots(snapshot_date, brand, region);

-- Enable RLS
ALTER TABLE public.ai_risk_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_kpi_snapshots ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage risk insights" ON public.ai_risk_insights;
DROP POLICY IF EXISTS "All authenticated can view risk insights" ON public.ai_risk_insights;
DROP POLICY IF EXISTS "System can insert risk insights" ON public.ai_risk_insights;
DROP POLICY IF EXISTS "System can update risk insights" ON public.ai_risk_insights;
DROP POLICY IF EXISTS "Admins can manage KPI snapshots" ON public.ai_kpi_snapshots;
DROP POLICY IF EXISTS "All authenticated can view KPI snapshots" ON public.ai_kpi_snapshots;
DROP POLICY IF EXISTS "System can insert KPI snapshots" ON public.ai_kpi_snapshots;

-- RLS policies for ai_risk_insights
CREATE POLICY "All authenticated can view risk insights"
ON public.ai_risk_insights FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert risk insights"
ON public.ai_risk_insights FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update risk insights"
ON public.ai_risk_insights FOR UPDATE
USING (true);

-- RLS policies for ai_kpi_snapshots  
CREATE POLICY "All authenticated can view KPI snapshots"
ON public.ai_kpi_snapshots FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert KPI snapshots"
ON public.ai_kpi_snapshots FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update KPI snapshots"
ON public.ai_kpi_snapshots FOR UPDATE
USING (true);