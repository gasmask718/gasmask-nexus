
-- ══════════════════════════════════════════════════════
-- AI CLOSER BRAIN LAYER — 7 NEW TABLES
-- ══════════════════════════════════════════════════════

-- 1) VA Call Sessions
CREATE TABLE public.brandaro_va_call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  va_user_id uuid NOT NULL,
  lead_id uuid,
  phone_number text,
  call_sid text,
  source text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  transcript text,
  summary text,
  call_outcome text,
  interest_level text,
  objection_count integer DEFAULT 0,
  buying_signal_count integer DEFAULT 0,
  urgency_level text,
  ai_analyzed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_va_call_sessions_va ON public.brandaro_va_call_sessions(va_user_id);
CREATE INDEX idx_va_call_sessions_lead ON public.brandaro_va_call_sessions(lead_id);
CREATE INDEX idx_va_call_sessions_created ON public.brandaro_va_call_sessions(created_at DESC);

ALTER TABLE public.brandaro_va_call_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "va_own_sessions" ON public.brandaro_va_call_sessions FOR ALL TO authenticated
  USING (va_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "va_insert_sessions" ON public.brandaro_va_call_sessions FOR INSERT TO authenticated
  WITH CHECK (va_user_id = auth.uid());

-- 2) VA Objection Events
CREATE TABLE public.brandaro_va_objection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES public.brandaro_va_call_sessions(id) ON DELETE CASCADE,
  va_user_id uuid NOT NULL,
  lead_id uuid,
  objection_type text NOT NULL,
  objection_text text,
  severity text,
  ai_recommended_response text,
  ai_strategy text,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_va_objections_session ON public.brandaro_va_objection_events(call_session_id);
CREATE INDEX idx_va_objections_va ON public.brandaro_va_objection_events(va_user_id);

ALTER TABLE public.brandaro_va_objection_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "va_objections_access" ON public.brandaro_va_objection_events FOR ALL TO authenticated
  USING (va_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 3) VA Buying Signals
CREATE TABLE public.brandaro_va_buying_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES public.brandaro_va_call_sessions(id) ON DELETE CASCADE,
  va_user_id uuid NOT NULL,
  lead_id uuid,
  signal_type text NOT NULL,
  signal_text text,
  signal_strength integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_va_signals_session ON public.brandaro_va_buying_signals(call_session_id);
CREATE INDEX idx_va_signals_va ON public.brandaro_va_buying_signals(va_user_id);

ALTER TABLE public.brandaro_va_buying_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "va_signals_access" ON public.brandaro_va_buying_signals FOR ALL TO authenticated
  USING (va_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4) VA Lead Heat
CREATE TABLE public.brandaro_va_lead_heat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE,
  latest_call_session_id uuid,
  heat_score numeric DEFAULT 0,
  closing_probability numeric DEFAULT 0,
  status text DEFAULT 'cold',
  last_signal_at timestamptz,
  last_objection_at timestamptz,
  next_best_action text,
  escalation_level text,
  recommended_callback_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_va_lead_heat_score ON public.brandaro_va_lead_heat(heat_score DESC);
CREATE INDEX idx_va_lead_heat_status ON public.brandaro_va_lead_heat(status);

ALTER TABLE public.brandaro_va_lead_heat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "va_lead_heat_read" ON public.brandaro_va_lead_heat FOR SELECT TO authenticated USING (true);
CREATE POLICY "va_lead_heat_write" ON public.brandaro_va_lead_heat FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR true);

-- 5) VA AI Recommendations
CREATE TABLE public.brandaro_va_ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  va_user_id uuid,
  lead_id uuid,
  call_session_id uuid REFERENCES public.brandaro_va_call_sessions(id) ON DELETE SET NULL,
  recommendation_type text NOT NULL,
  recommendation_title text NOT NULL,
  recommendation_body text NOT NULL,
  recommended_action text NOT NULL,
  priority integer DEFAULT 5,
  is_applied boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_va_recs_va ON public.brandaro_va_ai_recommendations(va_user_id);
CREATE INDEX idx_va_recs_lead ON public.brandaro_va_ai_recommendations(lead_id);

ALTER TABLE public.brandaro_va_ai_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "va_recs_access" ON public.brandaro_va_ai_recommendations FOR ALL TO authenticated
  USING (va_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 6) VA Closer Handoffs
CREATE TABLE public.brandaro_va_closer_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  source_call_session_id uuid REFERENCES public.brandaro_va_call_sessions(id) ON DELETE SET NULL,
  va_user_id uuid NOT NULL,
  closer_user_id uuid,
  handoff_reason text,
  lead_heat_score numeric DEFAULT 0,
  qualification_notes text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_va_handoffs_status ON public.brandaro_va_closer_handoffs(status);
CREATE INDEX idx_va_handoffs_va ON public.brandaro_va_closer_handoffs(va_user_id);

ALTER TABLE public.brandaro_va_closer_handoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "va_handoffs_access" ON public.brandaro_va_closer_handoffs FOR ALL TO authenticated
  USING (va_user_id = auth.uid() OR closer_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 7) VA Conversion Metrics
CREATE TABLE public.brandaro_va_conversion_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  va_user_id uuid NOT NULL,
  metric_date date NOT NULL,
  calls_completed integer DEFAULT 0,
  conversations integer DEFAULT 0,
  interested_leads integer DEFAULT 0,
  objections_handled integer DEFAULT 0,
  buying_signals_detected integer DEFAULT 0,
  demos_booked integer DEFAULT 0,
  closer_handoffs integer DEFAULT 0,
  payment_ready_leads integer DEFAULT 0,
  closes integer DEFAULT 0,
  revenue_generated numeric DEFAULT 0,
  avg_call_duration_seconds integer DEFAULT 0,
  avg_objections_per_call numeric DEFAULT 0,
  close_rate numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(va_user_id, metric_date)
);

CREATE INDEX idx_va_metrics_va ON public.brandaro_va_conversion_metrics(va_user_id);
CREATE INDEX idx_va_metrics_date ON public.brandaro_va_conversion_metrics(metric_date DESC);

ALTER TABLE public.brandaro_va_conversion_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "va_metrics_access" ON public.brandaro_va_conversion_metrics FOR ALL TO authenticated
  USING (va_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Enable realtime for hot leads and recommendations
ALTER PUBLICATION supabase_realtime ADD TABLE public.brandaro_va_lead_heat;
ALTER PUBLICATION supabase_realtime ADD TABLE public.brandaro_va_ai_recommendations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.brandaro_va_closer_handoffs;
