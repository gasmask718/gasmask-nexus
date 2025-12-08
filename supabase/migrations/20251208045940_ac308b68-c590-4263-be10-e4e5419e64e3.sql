-- Extend call_priority_queue with prediction fields
ALTER TABLE public.call_priority_queue 
ADD COLUMN IF NOT EXISTS predicted_answer_prob float,
ADD COLUMN IF NOT EXISTS predicted_order_prob float,
ADD COLUMN IF NOT EXISTS predicted_churn_risk float,
ADD COLUMN IF NOT EXISTS predicted_complaint_risk float,
ADD COLUMN IF NOT EXISTS persona_variant text,
ADD COLUMN IF NOT EXISTS script_variant text,
ADD COLUMN IF NOT EXISTS experiment_group text;

-- Extend ai_call_campaigns with experiment fields
ALTER TABLE public.ai_call_campaigns
ADD COLUMN IF NOT EXISTS experiment_mode boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS control_flow_id uuid,
ADD COLUMN IF NOT EXISTS variant_a_flow_id uuid,
ADD COLUMN IF NOT EXISTS variant_b_flow_id uuid,
ADD COLUMN IF NOT EXISTS experiment_split jsonb,
ADD COLUMN IF NOT EXISTS predictive_goal text;

-- Create CallPredictionSnapshots table
CREATE TABLE IF NOT EXISTS public.call_prediction_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid REFERENCES public.ai_call_campaigns(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.store_master(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create CallExperimentResults table
CREATE TABLE IF NOT EXISTS public.call_experiment_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid REFERENCES public.ai_call_campaigns(id) ON DELETE CASCADE,
  flow_variant text NOT NULL,
  persona_id uuid,
  calls integer DEFAULT 0,
  answered integer DEFAULT 0,
  orders integer DEFAULT 0,
  complaints integer DEFAULT 0,
  churn_signals integer DEFAULT 0,
  avg_sentiment float,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_prediction_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_experiment_results ENABLE ROW LEVEL SECURITY;

-- RLS policies for call_prediction_snapshots
CREATE POLICY "Allow all operations on call_prediction_snapshots" 
ON public.call_prediction_snapshots FOR ALL USING (true) WITH CHECK (true);

-- RLS policies for call_experiment_results
CREATE POLICY "Allow all operations on call_experiment_results" 
ON public.call_experiment_results FOR ALL USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_call_prediction_snapshots_campaign ON public.call_prediction_snapshots(campaign_id);
CREATE INDEX IF NOT EXISTS idx_call_prediction_snapshots_store ON public.call_prediction_snapshots(store_id);
CREATE INDEX IF NOT EXISTS idx_call_experiment_results_campaign ON public.call_experiment_results(campaign_id);