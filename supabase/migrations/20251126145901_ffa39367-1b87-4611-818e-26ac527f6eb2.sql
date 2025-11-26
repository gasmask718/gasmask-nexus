-- Create CEO Dashboard tables from scratch

-- Drop existing if any
DROP TABLE IF EXISTS public.excel_analyses CASCADE;
DROP TABLE IF EXISTS public.ceo_actions CASCADE;
DROP TABLE IF EXISTS public.ceo_forecasts CASCADE;

-- Excel analysis results
CREATE TABLE public.excel_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  upload_date TIMESTAMPTZ DEFAULT now(),
  columns_detected JSONB,
  data_classification JSONB,
  analysis_results JSONB,
  ai_summary TEXT,
  ai_recommendations TEXT,
  action_plan JSONB,
  attached_to_brand TEXT,
  attached_to_store UUID,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CEO actions and notes
CREATE TABLE public.ceo_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  assigned_to UUID REFERENCES auth.users(id),
  due_date DATE,
  related_brand TEXT,
  related_entity_id UUID,
  related_entity_type TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- CEO forecasts
CREATE TABLE public.ceo_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_date DATE NOT NULL DEFAULT CURRENT_DATE,
  forecast_type TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  predictions JSONB,
  confidence_score NUMERIC(3,2),
  data_sources JSONB,
  ai_reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.excel_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_forecasts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view analyses"
  ON public.excel_analyses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can create analyses"
  ON public.excel_analyses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage actions"
  ON public.ceo_actions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can view forecasts"
  ON public.ceo_forecasts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert forecasts"
  ON public.ceo_forecasts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_excel_analyses_upload_date ON public.excel_analyses(upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_ceo_actions_status_priority ON public.ceo_actions(status, priority);
CREATE INDEX IF NOT EXISTS idx_ceo_forecasts_forecast_date ON public.ceo_forecasts(forecast_date DESC);