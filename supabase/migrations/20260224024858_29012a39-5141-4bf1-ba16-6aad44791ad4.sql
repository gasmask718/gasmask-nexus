
-- PHASE C — CALL DISPOSITION + INTELLIGENCE ENGINE

-- 1. Structured Disposition Config (separate from legacy call_dispositions)
CREATE TABLE IF NOT EXISTS public.dialer_disposition_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  code text NOT NULL,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'neutral',
  requires_followup boolean DEFAULT false,
  followup_delay_minutes integer,
  marks_do_not_call boolean DEFAULT false,
  creates_invoice_draft boolean DEFAULT false,
  updates_store_stage text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(business_id, code)
);
ALTER TABLE public.dialer_disposition_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin access dialer_disposition_codes" ON public.dialer_disposition_codes FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner','va'))
);

-- Seed global defaults (business_id = NULL)
INSERT INTO public.dialer_disposition_codes (code, label, category, requires_followup, followup_delay_minutes, marks_do_not_call, creates_invoice_draft) VALUES
  ('INTERESTED', 'Interested', 'positive', true, 1440, false, false),
  ('CALL_BACK', 'Call Back', 'neutral', true, 1440, false, false),
  ('OWNER_NOT_AVAILABLE', 'Owner Not Available', 'neutral', true, 180, false, false),
  ('ORDER_PLACED', 'Order Placed', 'positive', false, null, false, true),
  ('NEEDS_SAMPLES', 'Needs Samples', 'positive', true, 2880, false, false),
  ('NOT_INTERESTED', 'Not Interested', 'negative', false, null, false, false),
  ('ALREADY_SUPPLIED', 'Already Supplied', 'negative', false, null, false, false),
  ('WRONG_NUMBER', 'Wrong Number', 'admin', false, null, false, false),
  ('DO_NOT_CALL', 'Do Not Call', 'admin', false, null, true, false);

-- 2. Session Disposition columns
ALTER TABLE public.live_call_sessions
  ADD COLUMN IF NOT EXISTS disposition_code_id uuid REFERENCES public.dialer_disposition_codes(id),
  ADD COLUMN IF NOT EXISTS disposition_notes text,
  ADD COLUMN IF NOT EXISTS next_followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS revenue_amount numeric,
  ADD COLUMN IF NOT EXISTS revenue_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS order_reference text,
  ADD COLUMN IF NOT EXISTS decision_maker_name text,
  ADD COLUMN IF NOT EXISTS competitor_mentioned text,
  ADD COLUMN IF NOT EXISTS best_call_time text,
  ADD COLUMN IF NOT EXISTS store_stage_after text;

-- 3. Follow-Up table for dialer
CREATE TABLE IF NOT EXISTS public.dialer_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  store_id uuid REFERENCES public.store_master(id),
  session_id uuid REFERENCES public.live_call_sessions(id),
  rep_user_id uuid,
  scheduled_for timestamptz NOT NULL,
  reason text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.dialer_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin access dialer_followups" ON public.dialer_followups FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner','va'))
);

-- 4. Store Call Intelligence
CREATE TABLE IF NOT EXISTS public.store_call_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.store_master(id) UNIQUE,
  last_decision_maker_name text,
  last_best_call_time text,
  last_competitor_mentioned text,
  last_objection text,
  interest_score integer DEFAULT 0,
  lifetime_revenue numeric DEFAULT 0,
  total_calls integer DEFAULT 0,
  total_connects integer DEFAULT 0,
  last_contacted_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.store_call_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin access store_call_intelligence" ON public.store_call_intelligence FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner','va'))
);

-- 5. Revenue Attribution
CREATE TABLE IF NOT EXISTS public.call_revenue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  session_id uuid REFERENCES public.live_call_sessions(id),
  campaign_id uuid REFERENCES public.dialer_campaigns(id),
  rep_user_id uuid,
  store_id uuid REFERENCES public.store_master(id),
  amount numeric NOT NULL,
  currency text DEFAULT 'USD',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.call_revenue_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin access call_revenue_events" ON public.call_revenue_events FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner','va'))
);

-- 6. Campaign Performance columns
ALTER TABLE public.dialer_campaigns
  ADD COLUMN IF NOT EXISTS total_revenue numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_positive_outcomes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_negative_outcomes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_followups integer DEFAULT 0;

-- 7. DO_NOT_CALL flag
ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS do_not_call boolean DEFAULT false;

-- 8. Rep Performance View
CREATE OR REPLACE VIEW public.rep_performance_metrics AS
SELECT
  s.rep_user_id,
  s.business_id,
  COUNT(*) AS total_dials,
  COUNT(*) FILTER (WHERE s.ended_at IS NOT NULL) AS total_connects,
  ROUND(COUNT(*) FILTER (WHERE s.ended_at IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS connect_rate,
  COUNT(s.disposition_code_id) AS total_dispositions,
  COUNT(*) FILTER (WHERE d.category = 'positive') AS positive_dispositions,
  COUNT(*) FILTER (WHERE d.category = 'negative') AS negative_dispositions,
  COALESCE(SUM(s.revenue_amount), 0) AS total_revenue,
  ROUND(COALESCE(SUM(s.revenue_amount), 0) / NULLIF(COUNT(*) FILTER (WHERE s.ended_at IS NOT NULL), 0), 2) AS revenue_per_connect,
  ROUND(COALESCE(SUM(s.revenue_amount), 0) / NULLIF(COUNT(*), 0) * 100, 2) AS revenue_per_100_dials
FROM public.live_call_sessions s
LEFT JOIN public.dialer_disposition_codes d ON s.disposition_code_id = d.id
WHERE s.rep_user_id IS NOT NULL
GROUP BY s.rep_user_id, s.business_id;

-- Enable realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dialer_followups;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.call_revenue_events;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
