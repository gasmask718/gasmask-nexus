
-- V5: Predictive Intelligence Layer Tables

-- Predictive Risk Scores (churn prediction)
CREATE TABLE public.predictive_risk_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.store_master(id) ON DELETE CASCADE,
  churn_risk INT NOT NULL DEFAULT 0 CHECK (churn_risk >= 0 AND churn_risk <= 100),
  risk_factors JSONB DEFAULT '[]'::jsonb,
  predicted_timeframe TEXT DEFAULT '30 days',
  ai_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Predictive Opportunity Scores (upsell/reactivation)
CREATE TABLE public.predictive_opportunity_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.store_master(id) ON DELETE CASCADE,
  opportunity_score INT NOT NULL DEFAULT 0 CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
  opportunity_factors JSONB DEFAULT '[]'::jsonb,
  predicted_product_interest TEXT,
  ai_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Communication Trend Snapshots
CREATE TABLE public.communication_trend_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  trend_type TEXT NOT NULL,
  trend_summary TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  forecast_period TEXT DEFAULT '7 days',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Predictive Actions (AI-recommended actions)
CREATE TABLE public.predictive_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.store_master(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  ai_reason TEXT,
  recommended_content TEXT,
  predicted_intent TEXT,
  executed BOOLEAN NOT NULL DEFAULT false,
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Predictive Autopilot Settings
CREATE TABLE public.predictive_autopilot_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  auto_recovery_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_upsell_enabled BOOLEAN NOT NULL DEFAULT false,
  churn_threshold INT NOT NULL DEFAULT 75,
  opportunity_threshold INT NOT NULL DEFAULT 80,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Predictive Autopilot Log
CREATE TABLE public.predictive_autopilot_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.store_master(id) ON DELETE CASCADE,
  action_id UUID REFERENCES public.predictive_actions(id) ON DELETE SET NULL,
  action_taken TEXT NOT NULL,
  ai_reasoning TEXT,
  result TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.predictive_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictive_opportunity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_trend_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictive_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictive_autopilot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictive_autopilot_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all access to predictive_risk_scores" ON public.predictive_risk_scores FOR ALL USING (true);
CREATE POLICY "Allow all access to predictive_opportunity_scores" ON public.predictive_opportunity_scores FOR ALL USING (true);
CREATE POLICY "Allow all access to communication_trend_snapshots" ON public.communication_trend_snapshots FOR ALL USING (true);
CREATE POLICY "Allow all access to predictive_actions" ON public.predictive_actions FOR ALL USING (true);
CREATE POLICY "Allow all access to predictive_autopilot_settings" ON public.predictive_autopilot_settings FOR ALL USING (true);
CREATE POLICY "Allow all access to predictive_autopilot_log" ON public.predictive_autopilot_log FOR ALL USING (true);

-- Indexes
CREATE INDEX idx_predictive_risk_scores_store ON public.predictive_risk_scores(store_id);
CREATE INDEX idx_predictive_risk_scores_churn ON public.predictive_risk_scores(churn_risk DESC);
CREATE INDEX idx_predictive_opportunity_scores_store ON public.predictive_opportunity_scores(store_id);
CREATE INDEX idx_predictive_opportunity_scores_score ON public.predictive_opportunity_scores(opportunity_score DESC);
CREATE INDEX idx_predictive_actions_store ON public.predictive_actions(store_id);
CREATE INDEX idx_predictive_actions_executed ON public.predictive_actions(executed);
CREATE INDEX idx_communication_trend_snapshots_type ON public.communication_trend_snapshots(trend_type);
