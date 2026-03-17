
-- brandaro_learning_events
CREATE TABLE public.brandaro_learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid,
  va_user_id uuid NOT NULL,
  lead_id uuid,
  outcome text,
  was_success boolean DEFAULT false,
  was_close boolean DEFAULT false,
  revenue_generated numeric DEFAULT 0,
  objections jsonb DEFAULT '[]'::jsonb,
  buying_signals jsonb DEFAULT '[]'::jsonb,
  strategies_used jsonb DEFAULT '[]'::jsonb,
  next_action_taken text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_ble_va ON public.brandaro_learning_events(va_user_id);
CREATE INDEX idx_ble_lead ON public.brandaro_learning_events(lead_id);
CREATE INDEX idx_ble_session ON public.brandaro_learning_events(call_session_id);
CREATE INDEX idx_ble_created ON public.brandaro_learning_events(created_at);
ALTER TABLE public.brandaro_learning_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own learning events" ON public.brandaro_learning_events FOR SELECT TO authenticated USING (va_user_id = auth.uid());
CREATE POLICY "Users can insert own learning events" ON public.brandaro_learning_events FOR INSERT TO authenticated WITH CHECK (va_user_id = auth.uid());
CREATE POLICY "Service can manage all learning events" ON public.brandaro_learning_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- brandaro_winning_patterns
CREATE TABLE public.brandaro_winning_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type text NOT NULL,
  pattern_key text NOT NULL,
  success_rate numeric DEFAULT 0,
  sample_size integer DEFAULT 0,
  avg_revenue numeric DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_bwp_type ON public.brandaro_winning_patterns(pattern_type);
CREATE INDEX idx_bwp_key ON public.brandaro_winning_patterns(pattern_key);
ALTER TABLE public.brandaro_winning_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read patterns" ON public.brandaro_winning_patterns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can manage patterns" ON public.brandaro_winning_patterns FOR ALL TO service_role USING (true) WITH CHECK (true);

-- brandaro_response_library
CREATE TABLE public.brandaro_response_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objection_type text NOT NULL,
  response_text text NOT NULL,
  strategy text,
  usage_count integer DEFAULT 0,
  success_count integer DEFAULT 0,
  success_rate numeric DEFAULT 0,
  avg_outcome_score numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_brl_objection ON public.brandaro_response_library(objection_type);
CREATE INDEX idx_brl_active ON public.brandaro_response_library(is_active);
ALTER TABLE public.brandaro_response_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read responses" ON public.brandaro_response_library FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can manage responses" ON public.brandaro_response_library FOR ALL TO service_role USING (true) WITH CHECK (true);

-- brandaro_va_skill_profiles
CREATE TABLE public.brandaro_va_skill_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  va_user_id uuid NOT NULL UNIQUE,
  objection_handling_score numeric DEFAULT 0,
  closing_score numeric DEFAULT 0,
  followup_score numeric DEFAULT 0,
  conversion_rate numeric DEFAULT 0,
  strongest_area text,
  weakest_area text,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_bvsp_va ON public.brandaro_va_skill_profiles(va_user_id);
ALTER TABLE public.brandaro_va_skill_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own skill profile" ON public.brandaro_va_skill_profiles FOR SELECT TO authenticated USING (va_user_id = auth.uid());
CREATE POLICY "Service can manage skill profiles" ON public.brandaro_va_skill_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Managers can read all skill profiles" ON public.brandaro_va_skill_profiles FOR SELECT TO authenticated USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.brandaro_winning_patterns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.brandaro_response_library;
ALTER PUBLICATION supabase_realtime ADD TABLE public.brandaro_va_skill_profiles;
