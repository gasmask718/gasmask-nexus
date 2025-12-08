-- Create OutboundPredictions table
CREATE TABLE IF NOT EXISTS public.outbound_predictions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  campaign_id uuid,
  store_id uuid REFERENCES public.store_master(id) ON DELETE CASCADE,
  answer_prob float,
  text_reply_prob float,
  order_prob float,
  churn_risk float,
  complaint_risk float,
  best_time_window text,
  recommended_persona text,
  recommended_script_variant text,
  recommended_channel text CHECK (recommended_channel IN ('call', 'sms', 'mixed')),
  snapshot jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create OutboundExperiments table
CREATE TABLE IF NOT EXISTS public.outbound_experiments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid,
  variant_name text NOT NULL,
  channel text CHECK (channel IN ('call', 'sms', 'mixed')),
  calls integer DEFAULT 0,
  sms integer DEFAULT 0,
  answered integer DEFAULT 0,
  replies integer DEFAULT 0,
  orders integer DEFAULT 0,
  complaints integer DEFAULT 0,
  avg_sentiment float,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create OutboundQueue table
CREATE TABLE IF NOT EXISTS public.outbound_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid,
  store_id uuid REFERENCES public.store_master(id) ON DELETE CASCADE,
  channel text CHECK (channel IN ('call', 'sms')),
  priority_score integer DEFAULT 50,
  experiment_group text,
  predicted_outcome jsonb DEFAULT '{}',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'done', 'failed')),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create OutboundPersonalizedScripts table
CREATE TABLE IF NOT EXISTS public.outbound_personalized_scripts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid,
  store_id uuid REFERENCES public.store_master(id) ON DELETE CASCADE,
  channel text CHECK (channel IN ('call', 'sms')),
  persona text,
  script jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.outbound_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_personalized_scripts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all operations on outbound_predictions" ON public.outbound_predictions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on outbound_experiments" ON public.outbound_experiments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on outbound_queue" ON public.outbound_queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on outbound_personalized_scripts" ON public.outbound_personalized_scripts FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_outbound_predictions_store ON public.outbound_predictions(store_id);
CREATE INDEX IF NOT EXISTS idx_outbound_predictions_campaign ON public.outbound_predictions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_outbound_queue_campaign ON public.outbound_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_outbound_queue_status ON public.outbound_queue(status);
CREATE INDEX IF NOT EXISTS idx_outbound_experiments_campaign ON public.outbound_experiments(campaign_id);