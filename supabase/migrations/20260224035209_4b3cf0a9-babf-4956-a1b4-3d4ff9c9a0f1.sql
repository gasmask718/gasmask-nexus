-- PHASE H Part 1: Tables only

CREATE TABLE IF NOT EXISTS public.dialer_disposition_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'neutral',
  creates_follow_up boolean DEFAULT false,
  creates_invoice_draft boolean DEFAULT false,
  pipeline_stage text,
  priority_weight numeric DEFAULT 1.0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.dialer_disposition_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage dialer_disposition_config" ON public.dialer_disposition_config FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner','va'))
);

INSERT INTO public.dialer_disposition_config (name, category, creates_follow_up, creates_invoice_draft, pipeline_stage, priority_weight) VALUES
  ('Interested', 'positive', true, false, 'interested', 3.0),
  ('Call Back', 'neutral', true, false, 'contacted', 2.0),
  ('Order Placed', 'positive', false, true, 'customer', 5.0),
  ('Needs Samples', 'positive', true, false, 'negotiating', 2.5),
  ('Owner Not Available', 'neutral', true, false, 'contacted', 1.0),
  ('Already With Competitor', 'negative', false, false, 'contacted', 0.5),
  ('Wrong Number', 'negative', false, false, 'cold', 0.0),
  ('Do Not Call', 'negative', false, false, 'do_not_call', 0.0),
  ('Not Interested', 'negative', false, false, 'contacted', 0.5)
ON CONFLICT DO NOTHING;

ALTER TABLE public.live_call_sessions
  ADD COLUMN IF NOT EXISTS disposition_id uuid REFERENCES public.dialer_disposition_config(id),
  ADD COLUMN IF NOT EXISTS estimated_revenue numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_revenue numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS order_created boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_up_scheduled boolean DEFAULT false;

ALTER TABLE public.store_answer_profile
  ADD COLUMN IF NOT EXISTS lifecycle_stage text DEFAULT 'cold';

CREATE TABLE IF NOT EXISTS public.call_revenue_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.live_call_sessions(id),
  store_id uuid REFERENCES public.store_master(id),
  campaign_id uuid,
  rep_user_id uuid,
  revenue_amount numeric DEFAULT 0,
  cost_amount numeric DEFAULT 0,
  net_profit numeric DEFAULT 0,
  attributed_at timestamptz DEFAULT now()
);
ALTER TABLE public.call_revenue_attribution ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin access call_revenue_attribution" ON public.call_revenue_attribution FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner','va'))
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_disposition_h ON public.live_call_sessions(disposition_id);
CREATE INDEX IF NOT EXISTS idx_revenue_attribution_session ON public.call_revenue_attribution(session_id);
CREATE INDEX IF NOT EXISTS idx_revenue_attribution_store ON public.call_revenue_attribution(store_id);
CREATE INDEX IF NOT EXISTS idx_revenue_attribution_campaign ON public.call_revenue_attribution(campaign_id);
CREATE INDEX IF NOT EXISTS idx_revenue_attribution_rep ON public.call_revenue_attribution(rep_user_id);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.call_revenue_attribution;
EXCEPTION WHEN duplicate_object THEN null;
END $$;