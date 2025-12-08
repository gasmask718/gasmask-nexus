-- AI Auto Dialer V2 Database Enhancements

-- Create call_optimization_stats table for campaign analytics
CREATE TABLE public.call_optimization_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID,
  average_call_duration INTEGER DEFAULT 0,
  answer_rate NUMERIC(5,2) DEFAULT 0,
  voicemail_rate NUMERIC(5,2) DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,
  best_time_to_call TEXT,
  best_persona TEXT,
  best_script TEXT,
  churn_prevention_score NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create call_priority_queue table for smart targeting
CREATE TABLE public.call_priority_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID,
  store_id UUID REFERENCES public.stores(id),
  priority_score INTEGER DEFAULT 50 CHECK (priority_score >= 0 AND priority_score <= 100),
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'calling', 'completed', 'failed', 'skipped')),
  ai_prediction JSONB DEFAULT '{}',
  last_order_date TIMESTAMP WITH TIME ZONE,
  risk_score INTEGER DEFAULT 0,
  opportunity_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ai_call_campaigns table for V2 campaign management
CREATE TABLE public.ai_call_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),
  priority_mode TEXT DEFAULT 'even' CHECK (priority_mode IN ('even', 'high_value', 'high_risk', 'reactivation', 'predictive')),
  target_segment TEXT,
  persona_id UUID,
  flow_id UUID,
  sequence_steps JSONB DEFAULT '{}',
  auto_followup_text BOOLEAN DEFAULT false,
  followup_template TEXT,
  prediction_snapshot JSONB DEFAULT '{}',
  sentiment_adaptation BOOLEAN DEFAULT false,
  dynamic_persona_switching BOOLEAN DEFAULT false,
  max_concurrent_calls INTEGER DEFAULT 5,
  retry_window_hours INTEGER DEFAULT 24,
  total_targets INTEGER DEFAULT 0,
  completed_calls INTEGER DEFAULT 0,
  answered_calls INTEGER DEFAULT 0,
  voicemail_count INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_optimization_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_priority_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_call_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call_optimization_stats
CREATE POLICY "Authenticated users can view call optimization stats"
  ON public.call_optimization_stats FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert call optimization stats"
  ON public.call_optimization_stats FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update call optimization stats"
  ON public.call_optimization_stats FOR UPDATE
  TO authenticated USING (true);

-- RLS Policies for call_priority_queue
CREATE POLICY "Authenticated users can view call priority queue"
  ON public.call_priority_queue FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage call priority queue"
  ON public.call_priority_queue FOR ALL
  TO authenticated USING (true);

-- RLS Policies for ai_call_campaigns
CREATE POLICY "Authenticated users can view ai call campaigns"
  ON public.ai_call_campaigns FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage ai call campaigns"
  ON public.ai_call_campaigns FOR ALL
  TO authenticated USING (true);

-- Create indexes for performance
CREATE INDEX idx_call_priority_queue_campaign ON public.call_priority_queue(campaign_id);
CREATE INDEX idx_call_priority_queue_status ON public.call_priority_queue(status);
CREATE INDEX idx_call_priority_queue_priority ON public.call_priority_queue(priority_score DESC);
CREATE INDEX idx_ai_call_campaigns_status ON public.ai_call_campaigns(status);
CREATE INDEX idx_ai_call_campaigns_business ON public.ai_call_campaigns(business_id);