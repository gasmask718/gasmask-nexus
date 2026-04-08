
-- =============================================
-- PART 1: NEW TABLES
-- =============================================

-- 1. photographer_applications
CREATE TABLE IF NOT EXISTS public.photographer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  business_name text,
  phone text,
  email text,
  website_url text,
  instagram_url text,
  city text,
  state text,
  zip text,
  lat numeric,
  lng numeric,
  service_radius_miles numeric DEFAULT 25,
  travel_mode text DEFAULT 'drive',
  equipment_types jsonb DEFAULT '[]'::jsonb,
  capabilities jsonb DEFAULT '[]'::jsonb,
  turnaround_speed text DEFAULT 'standard',
  rush_available boolean DEFAULT false,
  weekend_available boolean DEFAULT true,
  minimum_job_price numeric,
  preferred_price_range text,
  travel_fee_expectation numeric,
  rush_fee_expectation numeric,
  sample_work_links jsonb DEFAULT '[]'::jsonb,
  insurance_status text DEFAULT 'unknown',
  application_status text NOT NULL DEFAULT 'pending',
  review_notes text,
  approved_photographer_id uuid REFERENCES public.photographers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
ALTER TABLE public.photographer_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can submit photographer applications"
  ON public.photographer_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can view applications"
  ON public.photographer_applications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update applications"
  ON public.photographer_applications FOR UPDATE TO authenticated USING (true);

-- 2. photographer_territories
CREATE TABLE IF NOT EXISTS public.photographer_territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid NOT NULL REFERENCES public.photographers(id) ON DELETE CASCADE,
  city text,
  state text,
  zip text,
  lat numeric,
  lng numeric,
  radius_miles numeric DEFAULT 25,
  priority_weight numeric DEFAULT 1.0,
  is_primary boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.photographer_territories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage territories"
  ON public.photographer_territories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. virtual_tour_pricing_rules
CREATE TABLE IF NOT EXISTS public.virtual_tour_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text,
  state text,
  venue_type text,
  package_type text NOT NULL DEFAULT 'standard',
  base_price numeric NOT NULL DEFAULT 500,
  square_footage_min numeric,
  square_footage_max numeric,
  guest_capacity_min numeric,
  guest_capacity_max numeric,
  demand_multiplier numeric NOT NULL DEFAULT 1.0,
  luxury_multiplier numeric NOT NULL DEFAULT 1.0,
  rush_multiplier numeric NOT NULL DEFAULT 1.5,
  travel_fee_base numeric NOT NULL DEFAULT 50,
  travel_fee_per_mile numeric NOT NULL DEFAULT 0.65,
  stairs_multiplier numeric NOT NULL DEFAULT 1.1,
  outdoor_multiplier numeric NOT NULL DEFAULT 1.15,
  mixed_space_multiplier numeric NOT NULL DEFAULT 1.2,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.virtual_tour_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage pricing rules"
  ON public.virtual_tour_pricing_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. virtual_tour_quotes
CREATE TABLE IF NOT EXISTS public.virtual_tour_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.virtual_tour_requests(id) ON DELETE CASCADE,
  pricing_version text DEFAULT 'v2',
  package_type text NOT NULL DEFAULT 'standard',
  base_price numeric NOT NULL DEFAULT 0,
  adjustment_amount numeric DEFAULT 0,
  travel_fee numeric DEFAULT 0,
  rush_fee numeric DEFAULT 0,
  demand_fee numeric DEFAULT 0,
  platform_fee numeric DEFAULT 0,
  photographer_payout numeric DEFAULT 0,
  final_price_min numeric,
  final_price_max numeric,
  final_price_exact numeric,
  pricing_confidence_score numeric DEFAULT 0,
  quote_status text NOT NULL DEFAULT 'draft',
  quote_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  approved_at timestamptz
);
ALTER TABLE public.virtual_tour_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage quotes"
  ON public.virtual_tour_quotes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. photographer_scorecards
CREATE TABLE IF NOT EXISTS public.photographer_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photographer_id uuid NOT NULL REFERENCES public.photographers(id) ON DELETE CASCADE UNIQUE,
  jobs_completed integer DEFAULT 0,
  acceptance_rate numeric DEFAULT 100,
  completion_rate numeric DEFAULT 100,
  avg_turnaround_hours numeric DEFAULT 0,
  avg_rating numeric DEFAULT 5.0,
  cancellation_rate numeric DEFAULT 0,
  dispute_rate numeric DEFAULT 0,
  on_time_rate numeric DEFAULT 100,
  repeat_assignment_score numeric DEFAULT 0,
  quality_score numeric DEFAULT 5.0,
  last_calculated_at timestamptz DEFAULT now()
);
ALTER TABLE public.photographer_scorecards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view scorecards"
  ON public.photographer_scorecards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage scorecards"
  ON public.photographer_scorecards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. market_coverage_zones
CREATE TABLE IF NOT EXISTS public.market_coverage_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  state text NOT NULL,
  lat numeric,
  lng numeric,
  demand_score numeric DEFAULT 0,
  active_requests_count integer DEFAULT 0,
  completed_jobs_count integer DEFAULT 0,
  active_photographers_count integer DEFAULT 0,
  coverage_gap_score numeric DEFAULT 0,
  average_quote_value numeric DEFAULT 0,
  avg_time_to_assign numeric DEFAULT 0,
  recruitment_priority text DEFAULT 'low',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.market_coverage_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage coverage zones"
  ON public.market_coverage_zones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- PART 2: EXTEND EXISTING TABLES
-- =============================================

-- Extend photographers
ALTER TABLE public.photographers
  ADD COLUMN IF NOT EXISTS application_source text,
  ADD COLUMN IF NOT EXISTS photographer_tier text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS commission_rate numeric DEFAULT 80,
  ADD COLUMN IF NOT EXISTS minimum_job_price numeric,
  ADD COLUMN IF NOT EXISTS travel_fee_base numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rush_fee_percent numeric DEFAULT 50,
  ADD COLUMN IF NOT EXISTS average_turnaround_hours numeric,
  ADD COLUMN IF NOT EXISTS portfolio_url text,
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_method_status text DEFAULT 'not_setup',
  ADD COLUMN IF NOT EXISTS internal_notes text;

-- Extend virtual_tour_requests
ALTER TABLE public.virtual_tour_requests
  ADD COLUMN IF NOT EXISTS package_type text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS venue_category text,
  ADD COLUMN IF NOT EXISTS guest_capacity integer,
  ADD COLUMN IF NOT EXISTS room_count integer,
  ADD COLUMN IF NOT EXISTS wants_360 boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_matterport boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_video boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rush_requested boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parking_difficulty text,
  ADD COLUMN IF NOT EXISTS stairs_access text,
  ADD COLUMN IF NOT EXISTS decorated_state text,
  ADD COLUMN IF NOT EXISTS pricing_status text DEFAULT 'not_priced',
  ADD COLUMN IF NOT EXISTS demand_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS source_channel text DEFAULT 'os';

-- Extend photographer_jobs
ALTER TABLE public.photographer_jobs
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.virtual_tour_quotes(id),
  ADD COLUMN IF NOT EXISTS assignment_score numeric,
  ADD COLUMN IF NOT EXISTS distance_miles numeric,
  ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS en_route_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_upload_type text,
  ADD COLUMN IF NOT EXISTS qa_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS qa_notes text;

-- Extend venue_virtual_tours
ALTER TABLE public.venue_virtual_tours
  ADD COLUMN IF NOT EXISTS uploaded_by_photographer_id uuid REFERENCES public.photographers(id),
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS media_quality_score numeric,
  ADD COLUMN IF NOT EXISTS tour_format text,
  ADD COLUMN IF NOT EXISTS package_type text,
  ADD COLUMN IF NOT EXISTS source_job_id uuid REFERENCES public.photographer_jobs(id);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_photographer_applications_status ON public.photographer_applications(application_status);
CREATE INDEX IF NOT EXISTS idx_photographer_territories_photographer ON public.photographer_territories(photographer_id);
CREATE INDEX IF NOT EXISTS idx_photographer_territories_location ON public.photographer_territories(city, state);
CREATE INDEX IF NOT EXISTS idx_virtual_tour_quotes_request ON public.virtual_tour_quotes(request_id);
CREATE INDEX IF NOT EXISTS idx_virtual_tour_quotes_status ON public.virtual_tour_quotes(quote_status);
CREATE INDEX IF NOT EXISTS idx_market_coverage_zones_location ON public.market_coverage_zones(city, state);
CREATE INDEX IF NOT EXISTS idx_photographer_jobs_qa ON public.photographer_jobs(qa_status);
CREATE INDEX IF NOT EXISTS idx_photographer_jobs_payout ON public.photographer_jobs(payout_status);

-- =============================================
-- PART 13: RPC FUNCTIONS
-- =============================================

-- Dynamic pricing calculator
CREATE OR REPLACE FUNCTION public.vt_calculate_quote(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req record;
  v_rule record;
  v_base numeric;
  v_travel numeric;
  v_rush numeric;
  v_demand numeric;
  v_adjustments numeric;
  v_platform_fee numeric;
  v_photographer_payout numeric;
  v_total_min numeric;
  v_total_max numeric;
  v_confidence numeric;
  v_active_photographers integer;
  v_active_requests integer;
BEGIN
  SELECT * INTO v_req FROM virtual_tour_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Request not found');
  END IF;

  -- Find best matching pricing rule
  SELECT * INTO v_rule FROM virtual_tour_pricing_rules
    WHERE active = true
      AND (city IS NULL OR city = v_req.venue_name)
      AND (state IS NULL OR state = v_req.address)
      AND (venue_type IS NULL OR venue_type = v_req.venue_category)
      AND (package_type = COALESCE(v_req.package_type, 'standard'))
    ORDER BY
      CASE WHEN city IS NOT NULL THEN 0 ELSE 1 END,
      CASE WHEN state IS NOT NULL THEN 0 ELSE 1 END,
      CASE WHEN venue_type IS NOT NULL THEN 0 ELSE 1 END
    LIMIT 1;

  IF NOT FOUND THEN
    v_base := 500;
    v_rule := ROW(null, null, null, null, 'standard', 500, null, null, null, null, 1.0, 1.0, 1.5, 50, 0.65, 1.1, 1.15, 1.2, true, now(), now())::virtual_tour_pricing_rules;
  ELSE
    v_base := v_rule.base_price;
  END IF;

  -- Calculate adjustments
  v_adjustments := 0;
  IF v_req.stairs_access = 'difficult' THEN
    v_adjustments := v_adjustments + (v_base * (v_rule.stairs_multiplier - 1));
  END IF;

  -- Rush fee
  v_rush := 0;
  IF v_req.rush_requested THEN
    v_rush := v_base * (v_rule.rush_multiplier - 1);
  END IF;

  -- Travel fee estimate
  v_travel := v_rule.travel_fee_base;

  -- Demand pressure
  SELECT COUNT(*) INTO v_active_requests FROM virtual_tour_requests
    WHERE status IN ('pending', 'assigned') AND venue_name = v_req.venue_name;
  SELECT COUNT(*) INTO v_active_photographers FROM photographers
    WHERE is_active = true;

  v_demand := 0;
  IF v_active_photographers > 0 AND v_active_requests > v_active_photographers THEN
    v_demand := v_base * (v_rule.demand_multiplier - 1) * LEAST(v_active_requests::numeric / v_active_photographers, 2.0);
  END IF;

  -- Totals
  v_total_min := v_base + v_adjustments + v_travel;
  v_total_max := v_base + v_adjustments + v_travel + v_rush + v_demand;
  v_platform_fee := v_total_max * 0.20;
  v_photographer_payout := v_total_max - v_platform_fee;

  -- Confidence score
  v_confidence := 70;
  IF v_rule.city IS NOT NULL THEN v_confidence := v_confidence + 15; END IF;
  IF v_rule.venue_type IS NOT NULL THEN v_confidence := v_confidence + 10; END IF;
  IF v_req.guest_capacity IS NOT NULL THEN v_confidence := v_confidence + 5; END IF;

  -- Insert quote
  INSERT INTO virtual_tour_quotes (
    request_id, package_type, base_price, adjustment_amount,
    travel_fee, rush_fee, demand_fee, platform_fee, photographer_payout,
    final_price_min, final_price_max, pricing_confidence_score, quote_status
  ) VALUES (
    p_request_id, COALESCE(v_req.package_type, 'standard'), v_base, v_adjustments,
    v_travel, v_rush, v_demand, v_platform_fee, v_photographer_payout,
    v_total_min, v_total_max, LEAST(v_confidence, 100), 'estimated'
  );

  -- Update request pricing status
  UPDATE virtual_tour_requests SET pricing_status = 'quoted',
    pricing_snapshot = jsonb_build_object(
      'base', v_base, 'adjustments', v_adjustments, 'travel', v_travel,
      'rush', v_rush, 'demand', v_demand, 'total_min', v_total_min, 'total_max', v_total_max
    )
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'base_price', v_base, 'adjustments', v_adjustments, 'travel_fee', v_travel,
    'rush_fee', v_rush, 'demand_fee', v_demand, 'platform_fee', v_platform_fee,
    'photographer_payout', v_photographer_payout, 'total_min', v_total_min,
    'total_max', v_total_max, 'confidence', LEAST(v_confidence, 100)
  );
END;
$$;

-- Assignment scoring v2
CREATE OR REPLACE FUNCTION public.vt_score_assignment(
  p_request_id uuid
)
RETURNS TABLE(
  photographer_id uuid,
  photographer_name text,
  assignment_score numeric,
  distance_miles numeric,
  tier text,
  rating numeric,
  acceptance_rate numeric,
  completion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req record;
BEGIN
  SELECT * INTO v_req FROM virtual_tour_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN; END IF;

  RETURN QUERY
  WITH photographer_distances AS (
    SELECT
      p.id,
      p.name,
      p.photographer_tier,
      p.rating AS p_rating,
      p.minimum_job_price,
      3959 * ACOS(
        LEAST(1, GREATEST(-1,
          COS(RADIANS(COALESCE(v_req.lat, 0))) * COS(RADIANS(COALESCE(p.lat, 0))) *
          COS(RADIANS(COALESCE(p.lng, 0)) - RADIANS(COALESCE(v_req.lng, 0))) +
          SIN(RADIANS(COALESCE(v_req.lat, 0))) * SIN(RADIANS(COALESCE(p.lat, 0)))
        ))
      ) AS dist,
      p.radius_miles,
      COALESCE(sc.acceptance_rate, 100) AS acc_rate,
      COALESCE(sc.completion_rate, 100) AS comp_rate,
      COALESCE(sc.avg_rating, p.rating, 5.0) AS avg_r,
      COALESCE(sc.quality_score, 5.0) AS q_score,
      COALESCE(sc.on_time_rate, 100) AS ot_rate
    FROM photographers p
    LEFT JOIN photographer_scorecards sc ON sc.photographer_id = p.id
    WHERE p.is_active = true
  )
  SELECT
    pd.id AS photographer_id,
    pd.name AS photographer_name,
    (
      (GREATEST(0, 100 - pd.dist) * 0.25) +
      (pd.avg_r * 20 * 0.20) +
      (pd.acc_rate * 0.15) +
      (pd.comp_rate * 0.15) +
      (pd.ot_rate * 0.10) +
      (pd.q_score * 20 * 0.10) +
      (CASE pd.photographer_tier WHEN 'elite' THEN 100 WHEN 'premium' THEN 70 ELSE 40 END * 0.05)
    )::numeric AS assignment_score,
    pd.dist::numeric AS distance_miles,
    pd.photographer_tier AS tier,
    pd.avg_r::numeric AS rating,
    pd.acc_rate::numeric AS acceptance_rate,
    pd.comp_rate::numeric AS completion_rate
  FROM photographer_distances pd
  WHERE pd.dist <= pd.radius_miles
  ORDER BY assignment_score DESC
  LIMIT 20;
END;
$$;

-- Territory coverage refresh
CREATE OR REPLACE FUNCTION public.vt_refresh_coverage_zones()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  INSERT INTO market_coverage_zones (city, state, lat, lng, demand_score, active_requests_count, completed_jobs_count, active_photographers_count, coverage_gap_score, recruitment_priority)
  SELECT
    r.venue_name,
    '',
    AVG(r.lat),
    AVG(r.lng),
    COUNT(*) FILTER (WHERE r.status IN ('pending', 'assigned'))::numeric,
    COUNT(*) FILTER (WHERE r.status IN ('pending', 'assigned')),
    COUNT(*) FILTER (WHERE r.status = 'completed'),
    (SELECT COUNT(*) FROM photographers p WHERE p.is_active = true),
    CASE WHEN COUNT(*) FILTER (WHERE r.status IN ('pending', 'assigned')) > 0
         AND (SELECT COUNT(*) FROM photographers p WHERE p.is_active = true) = 0
         THEN 100 ELSE 0 END,
    CASE WHEN (SELECT COUNT(*) FROM photographers p WHERE p.is_active = true) = 0 THEN 'critical'
         WHEN COUNT(*) FILTER (WHERE r.status IN ('pending', 'assigned')) > 3 THEN 'high'
         ELSE 'low' END
  FROM virtual_tour_requests r
  WHERE r.venue_name IS NOT NULL
  GROUP BY r.venue_name
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
