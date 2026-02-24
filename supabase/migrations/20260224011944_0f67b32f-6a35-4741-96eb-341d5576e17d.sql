
-- Outbound Call Queue
CREATE TABLE public.outbound_call_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.store_master(id),
  contact_id UUID,
  phone_number TEXT NOT NULL,
  priority_score INTEGER DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','dialing','answered','voicemail','no_answer','bridged','failed','completed')),
  attempt_count INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  assigned_campaign_id UUID REFERENCES public.ai_call_campaigns(id),
  business_id UUID REFERENCES public.businesses(id),
  contact_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.outbound_call_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on outbound_call_queue"
  ON public.outbound_call_queue FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner','va')));

-- Live Call Sessions
CREATE TABLE public.live_call_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_item_id UUID REFERENCES public.outbound_call_queue(id),
  store_id UUID REFERENCES public.store_master(id),
  contact_name TEXT,
  rep_user_id UUID REFERENCES auth.users(id),
  call_sid TEXT,
  provider TEXT DEFAULT 'twilio',
  connected_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  outcome TEXT CHECK (outcome IN ('sale','follow_up','not_interested','wrong_number','callback','owner_not_available','no_disposition')),
  transcript_json JSONB,
  sentiment_score NUMERIC,
  recording_url TEXT,
  business_id UUID REFERENCES public.businesses(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.live_call_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on live_call_sessions"
  ON public.live_call_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner','va')));

-- Agent Availability
CREATE TABLE public.dialer_agent_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('available','busy','offline','wrap_up')),
  max_concurrent_calls INTEGER DEFAULT 1,
  active_calls_count INTEGER DEFAULT 0,
  skills TEXT[] DEFAULT '{}',
  last_status_change TIMESTAMPTZ DEFAULT now(),
  business_id UUID REFERENCES public.businesses(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.dialer_agent_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on dialer_agent_availability"
  ON public.dialer_agent_availability FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner','va')));
CREATE POLICY "Users manage own availability"
  ON public.dialer_agent_availability FOR ALL
  USING (user_id = auth.uid());

-- Dialer Settings
CREATE TABLE public.dialer_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) UNIQUE,
  default_voice_provider TEXT DEFAULT 'twilio',
  amd_sensitivity TEXT DEFAULT 'medium' CHECK (amd_sensitivity IN ('low','medium','high')),
  predictive_multiplier NUMERIC DEFAULT 5.0,
  max_concurrent_dials INTEGER DEFAULT 10,
  max_attempts_per_day INTEGER DEFAULT 3,
  retry_delay_minutes INTEGER DEFAULT 30,
  ai_voicemail_script TEXT,
  ai_prescreen_enabled BOOLEAN DEFAULT false,
  business_hours_start TIME DEFAULT '09:00',
  business_hours_end TIME DEFAULT '18:00',
  business_timezone TEXT DEFAULT 'America/New_York',
  after_hours_behavior TEXT DEFAULT 'stop' CHECK (after_hours_behavior IN ('stop','voicemail_only','queue_for_tomorrow')),
  enable_test_mode BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dialer_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access on dialer_settings"
  ON public.dialer_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner','va')));
