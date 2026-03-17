
-- VA Daily Performance tracking
CREATE TABLE public.brandaro_va_daily_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  va_user_id uuid NOT NULL,
  performance_date date NOT NULL DEFAULT CURRENT_DATE,
  calls_made int DEFAULT 0,
  calls_answered int DEFAULT 0,
  conversations int DEFAULT 0,
  interested_leads int DEFAULT 0,
  hot_leads int DEFAULT 0,
  demo_requests int DEFAULT 0,
  callbacks_booked int DEFAULT 0,
  callbacks_completed int DEFAULT 0,
  followups_sent int DEFAULT 0,
  payment_leads int DEFAULT 0,
  no_answers int DEFAULT 0,
  tasks_completed int DEFAULT 0,
  tasks_skipped int DEFAULT 0,
  tasks_overdue int DEFAULT 0,
  performance_score int DEFAULT 0,
  quota_calls int DEFAULT 75,
  quota_conversations int DEFAULT 20,
  quota_interested int DEFAULT 5,
  quota_demos int DEFAULT 2,
  shift_start timestamptz,
  shift_end timestamptz,
  is_on_shift boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(va_user_id, performance_date)
);

ALTER TABLE public.brandaro_va_daily_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_va_perf" ON public.brandaro_va_daily_performance FOR SELECT TO authenticated USING (true);
CREATE POLICY "upd_va_perf" ON public.brandaro_va_daily_performance FOR UPDATE TO authenticated USING (va_user_id = auth.uid());
CREATE POLICY "ins_va_perf" ON public.brandaro_va_daily_performance FOR INSERT TO authenticated WITH CHECK (true);

-- VA Task Queue
CREATE TABLE public.brandaro_va_task_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  va_user_id uuid NOT NULL,
  task_type text NOT NULL,
  lead_id uuid,
  campaign_id uuid,
  priority int DEFAULT 5,
  due_at timestamptz,
  status text DEFAULT 'pending',
  auto_generated boolean DEFAULT false,
  source_reason text,
  notes text,
  completed_at timestamptz,
  skipped_at timestamptz,
  escalated_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.brandaro_va_task_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_va_tq" ON public.brandaro_va_task_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "ins_va_tq" ON public.brandaro_va_task_queue FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "upd_va_tq" ON public.brandaro_va_task_queue FOR UPDATE TO authenticated USING (true);

-- VA Score Events
CREATE TABLE public.brandaro_va_score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  va_user_id uuid NOT NULL,
  event_type text NOT NULL,
  points int NOT NULL,
  reason text,
  related_lead_id uuid,
  related_task_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.brandaro_va_score_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_va_se" ON public.brandaro_va_score_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "ins_va_se" ON public.brandaro_va_score_events FOR INSERT TO authenticated WITH CHECK (true);

-- VA Coaching Notes
CREATE TABLE public.brandaro_va_coaching (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  va_user_id uuid NOT NULL,
  manager_user_id uuid NOT NULL,
  coaching_type text DEFAULT 'general',
  strengths text[],
  weak_points text[],
  improvement_target text,
  quality_score int,
  notes text,
  call_quality_score int,
  note_quality_score int,
  followup_quality_score int,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.brandaro_va_coaching ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_va_coach" ON public.brandaro_va_coaching FOR SELECT TO authenticated USING (true);
CREATE POLICY "ins_va_coach" ON public.brandaro_va_coaching FOR INSERT TO authenticated WITH CHECK (true);

-- VA Badges
CREATE TABLE public.brandaro_va_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  va_user_id uuid NOT NULL,
  badge_key text NOT NULL,
  badge_label text NOT NULL,
  badge_icon text,
  earned_date date DEFAULT CURRENT_DATE,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(va_user_id, badge_key, earned_date)
);

ALTER TABLE public.brandaro_va_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_va_badges" ON public.brandaro_va_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "ins_va_badges" ON public.brandaro_va_badges FOR INSERT TO authenticated WITH CHECK (true);

-- VA Alerts
CREATE TABLE public.brandaro_va_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text DEFAULT 'medium',
  title text NOT NULL,
  description text,
  target_va_id uuid,
  related_lead_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.brandaro_va_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_va_alerts" ON public.brandaro_va_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "ins_va_alerts" ON public.brandaro_va_alerts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "upd_va_alerts" ON public.brandaro_va_alerts FOR UPDATE TO authenticated USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.brandaro_va_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.brandaro_va_task_queue;
