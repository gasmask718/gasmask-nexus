-- Communication Center Tables

-- 1. Unified Messages Inbox
CREATE TABLE public.communication_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  store_id UUID REFERENCES public.store_master(id),
  contact_id UUID,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'call', 'ai-call', 'ai-sms', 'email', 'whatsapp')),
  content TEXT,
  phone_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'read', 'missed', 'failed', 'answered')),
  ai_generated BOOLEAN DEFAULT false,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. AI Text Sequences
CREATE TABLE public.ai_text_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  title TEXT NOT NULL,
  goal TEXT,
  steps JSONB DEFAULT '[]',
  target_filter JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. AI Call Logs
CREATE TABLE public.ai_call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  store_id UUID REFERENCES public.store_master(id),
  contact_id UUID,
  phone_number TEXT,
  script_id UUID,
  voice_id TEXT,
  duration_seconds INTEGER,
  transcription TEXT,
  outcome TEXT CHECK (outcome IN ('reached', 'no_answer', 'voicemail', 'busy', 'wrong_number', 'callback_requested')),
  ai_summary TEXT,
  follow_up_created BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Communication Sequences (Multi-step campaigns)
CREATE TABLE public.communication_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  title TEXT NOT NULL,
  description TEXT,
  goal TEXT,
  tone TEXT,
  steps JSONB DEFAULT '[]',
  target_stores UUID[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Communication Alerts
CREATE TABLE public.communication_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  store_id UUID REFERENCES public.store_master(id),
  contact_id UUID,
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Call Scripts (for AI calling)
CREATE TABLE public.call_scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  title TEXT NOT NULL,
  greeting TEXT,
  purpose TEXT,
  questions JSONB DEFAULT '[]',
  branching_logic JSONB DEFAULT '{}',
  closing TEXT,
  voice_type TEXT DEFAULT 'professional',
  language TEXT DEFAULT 'en',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_text_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_scripts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow authenticated users for now)
CREATE POLICY "Allow all for authenticated" ON public.communication_messages FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.ai_text_sequences FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.ai_call_logs FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.communication_sequences FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.communication_alerts FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON public.call_scripts FOR ALL USING (true);

-- Indexes for performance
CREATE INDEX idx_comm_messages_business ON public.communication_messages(business_id);
CREATE INDEX idx_comm_messages_store ON public.communication_messages(store_id);
CREATE INDEX idx_comm_messages_created ON public.communication_messages(created_at DESC);
CREATE INDEX idx_comm_alerts_business ON public.communication_alerts(business_id);
CREATE INDEX idx_comm_alerts_resolved ON public.communication_alerts(is_resolved);
