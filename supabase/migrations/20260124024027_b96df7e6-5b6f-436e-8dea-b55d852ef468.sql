-- ===========================================
-- VOICEMAIL, MISSED CALLS & CALL INTELLIGENCE
-- ===========================================

-- 1. Voicemails table
CREATE TABLE public.voicemails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  phone_number_id UUID REFERENCES public.business_phone_numbers(id),
  store_id UUID REFERENCES public.stores(id),
  contact_id UUID,
  call_log_id UUID,
  caller_number TEXT NOT NULL,
  caller_name TEXT,
  recording_url TEXT,
  recording_sid TEXT,
  duration_seconds INTEGER DEFAULT 0,
  transcription TEXT,
  transcription_status TEXT DEFAULT 'pending',
  reason TEXT,
  status TEXT DEFAULT 'new',
  assigned_to UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.profiles(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Call outcomes table (truth log for every call)
CREATE TABLE public.call_outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  phone_number_id UUID REFERENCES public.business_phone_numbers(id),
  call_sid TEXT,
  direction TEXT NOT NULL,
  caller_number TEXT,
  called_number TEXT,
  outcome TEXT NOT NULL,
  outcome_reason TEXT,
  resolution_path JSONB DEFAULT '[]',
  users_attempted TEXT[] DEFAULT '{}',
  ring_duration_seconds INTEGER,
  fallback_used TEXT,
  route_id UUID,
  route_type TEXT,
  is_business_hours BOOLEAN,
  local_time_at_call TEXT,
  timezone TEXT,
  suggested_fix TEXT,
  voicemail_id UUID REFERENCES public.voicemails(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Call intelligence signals
CREATE TABLE public.call_intelligence_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  signal_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  description TEXT,
  metric_value NUMERIC,
  metric_unit TEXT,
  related_entity_type TEXT,
  related_entity_id UUID,
  suggested_action TEXT,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.profiles(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Call followups (auto-generated tasks from missed calls/voicemails)
CREATE TABLE public.call_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  source_type TEXT NOT NULL,
  source_id UUID,
  call_outcome_id UUID REFERENCES public.call_outcomes(id),
  voicemail_id UUID REFERENCES public.voicemails(id),
  caller_number TEXT,
  caller_name TEXT,
  followup_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  assigned_to UUID REFERENCES public.profiles(id),
  due_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES public.profiles(id),
  auto_sms_sent BOOLEAN DEFAULT false,
  auto_sms_sent_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Business voicemail settings
CREATE TABLE public.business_voicemail_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) UNIQUE,
  is_enabled BOOLEAN DEFAULT true,
  greeting_type TEXT DEFAULT 'default',
  custom_greeting_url TEXT,
  custom_greeting_text TEXT,
  transcription_enabled BOOLEAN DEFAULT true,
  auto_followup_enabled BOOLEAN DEFAULT true,
  auto_sms_enabled BOOLEAN DEFAULT false,
  auto_sms_template TEXT DEFAULT 'Sorry we missed your call. We''ll get back to you shortly.',
  max_duration_seconds INTEGER DEFAULT 120,
  notify_users TEXT[] DEFAULT '{}',
  notify_roles TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voicemails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_intelligence_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_voicemail_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for voicemails
CREATE POLICY "Users can view voicemails for their business"
  ON public.voicemails FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update voicemails for their business"
  ON public.voicemails FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for call_outcomes
CREATE POLICY "Users can view call outcomes for their business"
  ON public.call_outcomes FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for call_intelligence_signals
CREATE POLICY "Users can view intelligence signals for their business"
  ON public.call_intelligence_signals FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update intelligence signals for their business"
  ON public.call_intelligence_signals FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for call_followups
CREATE POLICY "Users can view followups for their business"
  ON public.call_followups FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage followups for their business"
  ON public.call_followups FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for business_voicemail_settings
CREATE POLICY "Users can view voicemail settings for their business"
  ON public.business_voicemail_settings FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage voicemail settings for their business"
  ON public.business_voicemail_settings FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM public.user_profiles WHERE user_id = auth.uid()
    )
  );

-- Service role policies for edge functions
CREATE POLICY "Service role can insert voicemails"
  ON public.voicemails FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can insert call outcomes"
  ON public.call_outcomes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can insert intelligence signals"
  ON public.call_intelligence_signals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can insert followups"
  ON public.call_followups FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can insert voicemail settings"
  ON public.business_voicemail_settings FOR INSERT
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_voicemails_business ON public.voicemails(business_id);
CREATE INDEX idx_voicemails_status ON public.voicemails(status);
CREATE INDEX idx_voicemails_created ON public.voicemails(created_at DESC);
CREATE INDEX idx_call_outcomes_business ON public.call_outcomes(business_id);
CREATE INDEX idx_call_outcomes_outcome ON public.call_outcomes(outcome);
CREATE INDEX idx_call_outcomes_created ON public.call_outcomes(created_at DESC);
CREATE INDEX idx_call_intelligence_business ON public.call_intelligence_signals(business_id);
CREATE INDEX idx_call_intelligence_resolved ON public.call_intelligence_signals(is_resolved);
CREATE INDEX idx_call_followups_business ON public.call_followups(business_id);
CREATE INDEX idx_call_followups_status ON public.call_followups(status);

-- Trigger for updated_at
CREATE TRIGGER update_voicemails_updated_at
  BEFORE UPDATE ON public.voicemails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_call_followups_updated_at
  BEFORE UPDATE ON public.call_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_business_voicemail_settings_updated_at
  BEFORE UPDATE ON public.business_voicemail_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();