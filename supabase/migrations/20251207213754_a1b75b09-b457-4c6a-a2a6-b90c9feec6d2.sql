-- Communication Center V3: Intelligence Layer Tables

-- 1. Sentiment Analysis Table
CREATE TABLE public.sentiment_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.communication_messages(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  score INTEGER NOT NULL CHECK (score >= -100 AND score <= 100),
  keywords JSONB DEFAULT '[]',
  ai_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Conversation Routing Table
CREATE TABLE public.conversation_routing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.store_master(id) ON DELETE CASCADE,
  contact_id UUID,
  department TEXT NOT NULL CHECK (department IN ('Customer Service', 'Sales', 'Drivers', 'Bikers', 'Billing', 'Management')),
  reason TEXT,
  assigned_to UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Communication Escalations Table
CREATE TABLE public.communication_escalations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.store_master(id) ON DELETE CASCADE,
  contact_id UUID,
  message_id UUID REFERENCES public.communication_messages(id) ON DELETE SET NULL,
  escalation_type TEXT NOT NULL CHECK (escalation_type IN ('urgent', 'complaint', 'opportunity', 'negative_sentiment', 'billing', 'delivery')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  ai_notes TEXT,
  assigned_department TEXT,
  assigned_to UUID,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Engagement Scores Table
CREATE TABLE public.engagement_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.store_master(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 50 CHECK (score >= 0 AND score <= 100),
  response_rate NUMERIC(5,2) DEFAULT 0,
  avg_response_time_hours NUMERIC(10,2),
  last_contact TIMESTAMP WITH TIME ZONE,
  last_inbound TIMESTAMP WITH TIME ZONE,
  last_outbound TIMESTAMP WITH TIME ZONE,
  total_messages INTEGER DEFAULT 0,
  sentiment_trend TEXT CHECK (sentiment_trend IN ('improving', 'stable', 'declining')),
  ai_notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(business_id, store_id)
);

-- 5. Proactive Outreach Log
CREATE TABLE public.proactive_outreach_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.store_master(id) ON DELETE CASCADE,
  trigger_reason TEXT NOT NULL,
  message_sent TEXT,
  persona_id UUID REFERENCES public.voice_personas(id) ON DELETE SET NULL,
  channel TEXT DEFAULT 'sms',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sentiment_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_routing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proactive_outreach_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all access to sentiment_analysis" ON public.sentiment_analysis FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to conversation_routing" ON public.conversation_routing FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to communication_escalations" ON public.communication_escalations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to engagement_scores" ON public.engagement_scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to proactive_outreach_log" ON public.proactive_outreach_log FOR ALL USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_sentiment_message ON public.sentiment_analysis(message_id);
CREATE INDEX idx_sentiment_business ON public.sentiment_analysis(business_id);
CREATE INDEX idx_routing_business ON public.conversation_routing(business_id);
CREATE INDEX idx_routing_store ON public.conversation_routing(store_id);
CREATE INDEX idx_escalations_business ON public.communication_escalations(business_id);
CREATE INDEX idx_escalations_resolved ON public.communication_escalations(resolved);
CREATE INDEX idx_engagement_business_store ON public.engagement_scores(business_id, store_id);
CREATE INDEX idx_outreach_business ON public.proactive_outreach_log(business_id);