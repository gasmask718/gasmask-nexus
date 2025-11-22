-- Create ceo_reports table
CREATE TABLE public.ceo_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  report_type TEXT NOT NULL DEFAULT 'weekly',
  kpi_summary JSONB DEFAULT '{}'::jsonb,
  pipeline_status JSONB DEFAULT '{}'::jsonb,
  cashflow_forecast JSONB DEFAULT '{}'::jsonb,
  bottlenecks JSONB DEFAULT '[]'::jsonb,
  team_performance JSONB DEFAULT '{}'::jsonb,
  priority_plan JSONB DEFAULT '[]'::jsonb,
  recommendations TEXT,
  ai_confidence_score INTEGER DEFAULT 85,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT DEFAULT 'ai-ceo-engine'
);

-- Create ceo_decisions table
CREATE TABLE public.ceo_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  decision TEXT NOT NULL,
  reasoning TEXT,
  confidence_score INTEGER DEFAULT 0,
  expected_impact JSONB DEFAULT '{}'::jsonb,
  actual_impact JSONB DEFAULT '{}'::jsonb,
  implemented_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create ceo_actions table
CREATE TABLE public.ceo_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  target_entity_type TEXT,
  target_entity_id UUID,
  priority TEXT DEFAULT 'medium',
  assigned_to UUID,
  automated BOOLEAN DEFAULT true,
  executed_at TIMESTAMPTZ,
  result JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  due_date TIMESTAMPTZ
);

-- Create ceo_forecasts table
CREATE TABLE public.ceo_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_type TEXT NOT NULL,
  forecast_period TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  predicted_revenue NUMERIC,
  predicted_deals_closed INTEGER,
  predicted_assignment_fees NUMERIC,
  market_conditions JSONB DEFAULT '{}'::jsonb,
  risk_factors JSONB DEFAULT '[]'::jsonb,
  opportunities JSONB DEFAULT '[]'::jsonb,
  accuracy_score INTEGER,
  actual_results JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  forecast_date DATE NOT NULL
);

-- Create ceo_learning_logs table for the learning engine
CREATE TABLE public.ceo_learning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_type TEXT NOT NULL,
  data_source TEXT NOT NULL,
  insights JSONB DEFAULT '[]'::jsonb,
  strategy_adjustments JSONB DEFAULT '[]'::jsonb,
  performance_improvement NUMERIC,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.ceo_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_learning_logs ENABLE ROW LEVEL SECURITY;

-- ceo_reports policies
CREATE POLICY "Admins manage ceo_reports"
  ON public.ceo_reports
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System insert ceo_reports"
  ON public.ceo_reports
  FOR INSERT
  WITH CHECK (true);

-- ceo_decisions policies
CREATE POLICY "Admins manage ceo_decisions"
  ON public.ceo_decisions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System insert ceo_decisions"
  ON public.ceo_decisions
  FOR INSERT
  WITH CHECK (true);

-- ceo_actions policies
CREATE POLICY "Admins manage ceo_actions"
  ON public.ceo_actions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System insert ceo_actions"
  ON public.ceo_actions
  FOR INSERT
  WITH CHECK (true);

-- ceo_forecasts policies
CREATE POLICY "Admins manage ceo_forecasts"
  ON public.ceo_forecasts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System insert ceo_forecasts"
  ON public.ceo_forecasts
  FOR INSERT
  WITH CHECK (true);

-- ceo_learning_logs policies
CREATE POLICY "Admins view ceo_learning_logs"
  ON public.ceo_learning_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System insert ceo_learning_logs"
  ON public.ceo_learning_logs
  FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_ceo_reports_date ON public.ceo_reports(report_date DESC);
CREATE INDEX idx_ceo_decisions_entity ON public.ceo_decisions(entity_type, entity_id);
CREATE INDEX idx_ceo_decisions_status ON public.ceo_decisions(status);
CREATE INDEX idx_ceo_actions_status ON public.ceo_actions(status);
CREATE INDEX idx_ceo_actions_assigned ON public.ceo_actions(assigned_to);
CREATE INDEX idx_ceo_forecasts_date ON public.ceo_forecasts(forecast_date DESC);