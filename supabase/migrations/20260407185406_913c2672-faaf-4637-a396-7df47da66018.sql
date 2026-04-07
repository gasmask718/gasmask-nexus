
-- ============================================
-- 1. DISPATCH REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.media_dispatch_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.media_bookings(id),
  client_id uuid,
  location_lat numeric,
  location_lng numeric,
  city text,
  event_type text,
  duration_hours numeric,
  budget_range text,
  urgency_level text DEFAULT 'normal',
  status text DEFAULT 'searching',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.media_dispatch_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_dispatch_req_status ON public.media_dispatch_requests(status);
CREATE INDEX idx_dispatch_req_city ON public.media_dispatch_requests(city);
CREATE INDEX idx_dispatch_req_created ON public.media_dispatch_requests(created_at DESC);

CREATE POLICY "Admins full access dispatch_requests" ON public.media_dispatch_requests
  FOR ALL USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Clients view own dispatch requests" ON public.media_dispatch_requests
  FOR SELECT USING (client_id = auth.uid());

-- ============================================
-- 2. DISPATCH CANDIDATES
-- ============================================
CREATE TABLE IF NOT EXISTS public.media_dispatch_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_request_id uuid NOT NULL REFERENCES public.media_dispatch_requests(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.media_creators(id) ON DELETE CASCADE,
  distance_miles numeric,
  score numeric,
  notified_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.media_dispatch_candidates ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_dispatch_cand_request ON public.media_dispatch_candidates(dispatch_request_id);
CREATE INDEX idx_dispatch_cand_creator ON public.media_dispatch_candidates(creator_id);
CREATE INDEX idx_dispatch_cand_status ON public.media_dispatch_candidates(status);

CREATE POLICY "Creators view own dispatch candidates" ON public.media_dispatch_candidates
  FOR SELECT USING (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()));
CREATE POLICY "Creators update own dispatch candidates" ON public.media_dispatch_candidates
  FOR UPDATE USING (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()));
CREATE POLICY "Admins full access dispatch_candidates" ON public.media_dispatch_candidates
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- ============================================
-- 3. DEMAND METRICS
-- ============================================
CREATE TABLE IF NOT EXISTS public.media_demand_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text,
  event_type text,
  demand_level text DEFAULT 'low',
  active_requests int DEFAULT 0,
  available_creators int DEFAULT 0,
  surge_multiplier numeric DEFAULT 1,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.media_demand_metrics ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_demand_city ON public.media_demand_metrics(city);
CREATE INDEX idx_demand_event ON public.media_demand_metrics(event_type);

CREATE POLICY "Public can read demand metrics" ON public.media_demand_metrics
  FOR SELECT USING (true);
CREATE POLICY "Admins full access demand_metrics" ON public.media_demand_metrics
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- ============================================
-- 4. CREATOR RANKINGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.media_creator_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.media_creators(id) ON DELETE CASCADE,
  overall_score numeric DEFAULT 0,
  ranking_tier text DEFAULT 'bronze',
  last_calculated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.media_creator_rankings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rankings_creator ON public.media_creator_rankings(creator_id);
CREATE INDEX idx_rankings_tier ON public.media_creator_rankings(ranking_tier);
CREATE INDEX idx_rankings_score ON public.media_creator_rankings(overall_score DESC);

CREATE POLICY "Public can view rankings" ON public.media_creator_rankings
  FOR SELECT USING (true);
CREATE POLICY "Admins full access rankings" ON public.media_creator_rankings
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- ============================================
-- 5. CREATOR INSIGHTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.media_creator_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.media_creators(id) ON DELETE CASCADE,
  insight_type text NOT NULL,
  message text NOT NULL,
  priority text DEFAULT 'medium',
  is_dismissed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.media_creator_insights ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_insights_creator ON public.media_creator_insights(creator_id);
CREATE INDEX idx_insights_type ON public.media_creator_insights(insight_type);

CREATE POLICY "Creators view own insights" ON public.media_creator_insights
  FOR SELECT USING (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()));
CREATE POLICY "Creators dismiss own insights" ON public.media_creator_insights
  FOR UPDATE USING (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()));
CREATE POLICY "Admins full access insights" ON public.media_creator_insights
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- ============================================
-- 6. USER ENGAGEMENT
-- ============================================
CREATE TABLE IF NOT EXISTS public.media_user_engagement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  creator_id uuid REFERENCES public.media_creators(id) ON DELETE CASCADE,
  interaction_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.media_user_engagement ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_engagement_user ON public.media_user_engagement(user_id);
CREATE INDEX idx_engagement_creator ON public.media_user_engagement(creator_id);
CREATE INDEX idx_engagement_type ON public.media_user_engagement(interaction_type);

CREATE POLICY "Users manage own engagement" ON public.media_user_engagement
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins full access engagement" ON public.media_user_engagement
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- ============================================
-- 7. AI LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.media_ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES public.media_creators(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  input_data jsonb DEFAULT '{}',
  output_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.media_ai_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ai_logs_creator ON public.media_ai_logs(creator_id);
CREATE INDEX idx_ai_logs_action ON public.media_ai_logs(action_type);
CREATE INDEX idx_ai_logs_created ON public.media_ai_logs(created_at DESC);

CREATE POLICY "Creators view own AI logs" ON public.media_ai_logs
  FOR SELECT USING (creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid()));
CREATE POLICY "Admins full access ai_logs" ON public.media_ai_logs
  FOR ALL USING (public.is_admin_user(auth.uid()));

-- ============================================
-- 8. EXTEND BOOKINGS
-- ============================================
ALTER TABLE public.media_bookings
  ADD COLUMN IF NOT EXISTS dispatch_request_id uuid REFERENCES public.media_dispatch_requests(id),
  ADD COLUMN IF NOT EXISTS surge_applied numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_score_at_booking numeric,
  ADD COLUMN IF NOT EXISTS booking_source text DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS ai_price_used boolean DEFAULT false;

-- ============================================
-- 9. EXTEND JOB OFFERS
-- ============================================
ALTER TABLE public.media_job_offers
  ADD COLUMN IF NOT EXISTS priority_score numeric,
  ADD COLUMN IF NOT EXISTS recommended_creator_rank int,
  ADD COLUMN IF NOT EXISTS urgency_multiplier numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ai_match_score numeric;

-- ============================================
-- 10. SCORING FUNCTION v2
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_creator_score_v2(
  p_rating numeric,
  p_acceptance_rate numeric,
  p_cancellation_rate numeric,
  p_response_time numeric,
  p_total_jobs numeric
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN round((
    (coalesce(p_rating, 0) / 5.0 * 40) +
    (coalesce(p_acceptance_rate, 0) / 100.0 * 20) -
    (coalesce(p_cancellation_rate, 0) / 100.0 * 20) +
    ((1.0 / GREATEST(coalesce(p_response_time, 24), 0.5)) * 10) +
    (LEAST(coalesce(p_total_jobs, 0), 200) / 200.0 * 10)
  ), 2);
END;
$$;

-- ============================================
-- 11. DYNAMIC PRICING FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_dynamic_price(
  p_base_price numeric,
  p_demand_level text,
  p_urgency text
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_multiplier numeric := 1.0;
BEGIN
  IF p_demand_level = 'high' THEN v_multiplier := v_multiplier + 0.25;
  ELSIF p_demand_level = 'medium' THEN v_multiplier := v_multiplier + 0.10;
  END IF;

  IF p_urgency = 'rush' THEN v_multiplier := v_multiplier + 0.30;
  ELSIF p_urgency = 'priority' THEN v_multiplier := v_multiplier + 0.15;
  END IF;

  RETURN round(p_base_price * v_multiplier, 2);
END;
$$;

-- ============================================
-- 12. CREATOR RECOMMENDATIONS RPC
-- ============================================
CREATE OR REPLACE FUNCTION public.get_creator_recommendations()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
  v_recs json[] := '{}';
  v_rec record;
BEGIN
  SELECT id INTO v_creator_id FROM media_creators WHERE user_id = auth.uid() LIMIT 1;
  IF v_creator_id IS NULL THEN RETURN '[]'::json; END IF;

  -- Check profile photo
  IF (SELECT profile_image_url IS NULL FROM media_creators WHERE id = v_creator_id) THEN
    v_recs := array_append(v_recs, json_build_object('type','profile','priority','high','message','Upload a profile photo to build trust'));
  END IF;
  -- Check portfolio count
  IF (SELECT count(*) FROM media_creator_projects WHERE creator_id = v_creator_id) < 3 THEN
    v_recs := array_append(v_recs, json_build_object('type','portfolio','priority','high','message','Upload at least 3 portfolio items to boost visibility'));
  END IF;
  -- Check gear
  IF (SELECT count(*) FROM media_creator_gear WHERE creator_id = v_creator_id) = 0 THEN
    v_recs := array_append(v_recs, json_build_object('type','gear','priority','medium','message','List your gear to show clients your capabilities'));
  END IF;
  -- Check availability
  IF (SELECT count(*) FROM media_creator_availability_rules WHERE creator_id = v_creator_id) = 0 THEN
    v_recs := array_append(v_recs, json_build_object('type','availability','priority','high','message','Set your weekly availability to receive job offers'));
  END IF;
  -- Check instant booking
  IF (SELECT accepts_instant_bookings FROM media_creators WHERE id = v_creator_id) = false THEN
    v_recs := array_append(v_recs, json_build_object('type','booking','priority','medium','message','Enable instant booking to get more jobs'));
  END IF;
  -- Check drone
  IF (SELECT drone_available FROM media_creators WHERE id = v_creator_id) = false THEN
    v_recs := array_append(v_recs, json_build_object('type','capability','priority','low','message','Add drone coverage to increase bookings by up to 30%'));
  END IF;

  RETURN array_to_json(v_recs);
END;
$$;

-- ============================================
-- 13. REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_dispatch_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_dispatch_candidates;
DO $$
BEGIN
  -- media_bookings may already be in the publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.media_bookings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
