
-- Closer AI Sessions
CREATE TABLE public.brandaro_closer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  session_type TEXT NOT NULL DEFAULT 'sms',
  opener_used TEXT,
  playbook_used TEXT,
  objection_detected TEXT,
  rebuttal_used TEXT,
  confidence_score NUMERIC DEFAULT 0,
  close_probability NUMERIC DEFAULT 0,
  handoff_score NUMERIC DEFAULT 0,
  urgency_score NUMERIC DEFAULT 0,
  package_interest TEXT,
  price_anchor_seen BOOLEAN DEFAULT false,
  payment_link_sent BOOLEAN DEFAULT false,
  payment_link_clicked BOOLEAN DEFAULT false,
  payment_link_sent_at TIMESTAMPTZ,
  payment_link_clicked_at TIMESTAMPTZ,
  payment_abandoned BOOLEAN DEFAULT false,
  closed BOOLEAN DEFAULT false,
  lost_reason TEXT,
  assigned_human_closer UUID,
  human_takeover_at TIMESTAMPTZ,
  outcome TEXT,
  priority_score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_closer_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage closer sessions" ON public.brandaro_closer_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Closer Events (timeline of actions per session)
CREATE TABLE public.brandaro_closer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.brandaro_closer_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor TEXT DEFAULT 'ai',
  message_content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_closer_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage closer events" ON public.brandaro_closer_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Closer Playbooks
CREATE TABLE public.brandaro_closer_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  opening_line TEXT,
  emotional_frame TEXT,
  value_positioning TEXT,
  urgency_line TEXT,
  cta TEXT,
  handoff_condition TEXT,
  stop_condition TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_closer_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage playbooks" ON public.brandaro_closer_playbooks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Closer Rebuttals (unified rebuttal engine)
CREATE TABLE public.brandaro_closer_rebuttals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objection_key TEXT NOT NULL,
  label TEXT NOT NULL,
  ai_response TEXT,
  human_response TEXT,
  soft_rebuttal TEXT,
  aggressive_rebuttal TEXT,
  premium_rebuttal TEXT,
  downgrade_path TEXT,
  upsell_path TEXT,
  close_success_rate NUMERIC DEFAULT 0,
  times_used INTEGER DEFAULT 0,
  times_won INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_closer_rebuttals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage rebuttals" ON public.brandaro_closer_rebuttals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Human Handoff Queue
CREATE TABLE public.brandaro_human_handoff_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.brandaro_closer_sessions(id),
  lead_id UUID,
  reason TEXT NOT NULL,
  handoff_score NUMERIC DEFAULT 0,
  deal_value NUMERIC DEFAULT 0,
  package_tier TEXT,
  assigned_closer UUID,
  status TEXT DEFAULT 'pending',
  picked_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  outcome TEXT,
  closer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_human_handoff_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage handoff queue" ON public.brandaro_human_handoff_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Close Reviews (human feedback loop)
CREATE TABLE public.brandaro_close_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.brandaro_closer_sessions(id),
  lead_id UUID,
  original_ai_classification TEXT,
  human_correction TEXT,
  final_outcome TEXT,
  winning_message TEXT,
  winning_rebuttal TEXT,
  package_sold TEXT,
  reason_bought TEXT,
  reason_lost TEXT,
  reviewer_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_close_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage close reviews" ON public.brandaro_close_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Win/Loss Analysis
CREATE TABLE public.brandaro_win_loss_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  session_id UUID REFERENCES public.brandaro_closer_sessions(id),
  result TEXT NOT NULL,
  lost_reason TEXT,
  won_trigger TEXT,
  closer_type TEXT,
  package TEXT,
  urgency_trigger TEXT,
  objection_overcome TEXT,
  proof_used TEXT,
  payment_plan_used BOOLEAN DEFAULT false,
  touches_to_close INTEGER DEFAULT 0,
  deal_value NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.brandaro_win_loss_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage win loss" ON public.brandaro_win_loss_analysis FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_closer_sessions_lead ON public.brandaro_closer_sessions(lead_id);
CREATE INDEX idx_closer_sessions_outcome ON public.brandaro_closer_sessions(outcome);
CREATE INDEX idx_closer_sessions_created ON public.brandaro_closer_sessions(created_at);
CREATE INDEX idx_handoff_queue_status ON public.brandaro_human_handoff_queue(status);
CREATE INDEX idx_rebuttals_key ON public.brandaro_closer_rebuttals(objection_key);
CREATE INDEX idx_win_loss_result ON public.brandaro_win_loss_analysis(result);
