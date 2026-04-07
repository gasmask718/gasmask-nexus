
-- ============================================
-- TOPTIER MEDIA ENGINE UPGRADE
-- ============================================

-- 1. media_pricing_rules
CREATE TABLE public.media_pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  demand_level TEXT NOT NULL DEFAULT 'medium',
  multiplier NUMERIC NOT NULL DEFAULT 1.0,
  rush_fee NUMERIC NOT NULL DEFAULT 0,
  peak_hours JSONB DEFAULT '{"start": 17, "end": 22}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.media_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view pricing rules"
  ON public.media_pricing_rules FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert pricing rules"
  ON public.media_pricing_rules FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update pricing rules"
  ON public.media_pricing_rules FOR UPDATE
  TO authenticated USING (true);

CREATE INDEX idx_pricing_city_demand ON public.media_pricing_rules(city, demand_level);

-- 2. media_dispatch_responses
CREATE TABLE public.media_dispatch_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.media_bookings(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.media_creators(id),
  status TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.media_dispatch_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking owner can view dispatch responses"
  ON public.media_dispatch_responses FOR SELECT
  TO authenticated USING (
    booking_id IN (SELECT id FROM public.media_bookings WHERE user_id = auth.uid())
  );

CREATE POLICY "Dispatched creator can view own responses"
  ON public.media_dispatch_responses FOR SELECT
  TO authenticated USING (
    creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid())
  );

CREATE POLICY "Authenticated can insert dispatch responses"
  ON public.media_dispatch_responses FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Creator can update own response"
  ON public.media_dispatch_responses FOR UPDATE
  TO authenticated USING (
    creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid())
  );

CREATE INDEX idx_dispatch_resp_booking ON public.media_dispatch_responses(booking_id);
CREATE INDEX idx_dispatch_resp_creator ON public.media_dispatch_responses(creator_id);
CREATE INDEX idx_dispatch_resp_status ON public.media_dispatch_responses(status);

-- 3. availability_sessions
CREATE TABLE public.availability_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.media_creators(id) ON DELETE CASCADE,
  is_live BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE public.availability_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can manage own sessions"
  ON public.availability_sessions FOR ALL
  TO authenticated USING (
    creator_id IN (SELECT id FROM public.media_creators WHERE user_id = auth.uid())
  );

CREATE POLICY "Authenticated can view active sessions"
  ON public.availability_sessions FOR SELECT
  TO authenticated USING (is_live = true);

CREATE INDEX idx_avail_creator ON public.availability_sessions(creator_id);
CREATE INDEX idx_avail_live ON public.availability_sessions(is_live);

-- 4. Add last_active_at to media_creators
ALTER TABLE public.media_creators
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT now();

-- 5. Pricing function
CREATE OR REPLACE FUNCTION public.calculate_media_price(
  p_city TEXT,
  p_duration_hours NUMERIC,
  p_service_type TEXT,
  p_demand_level TEXT DEFAULT 'medium',
  p_base_rate NUMERIC DEFAULT 150
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_multiplier NUMERIC := 1.0;
  v_rush_fee NUMERIC := 0;
  v_base NUMERIC;
  v_final NUMERIC;
BEGIN
  SELECT multiplier, rush_fee INTO v_multiplier, v_rush_fee
  FROM public.media_pricing_rules
  WHERE city = p_city AND demand_level = p_demand_level
  LIMIT 1;

  IF v_multiplier IS NULL THEN
    v_multiplier := 1.0;
    v_rush_fee := 0;
  END IF;

  v_base := p_base_rate * p_duration_hours;
  v_final := (v_base * v_multiplier) + v_rush_fee;

  RETURN jsonb_build_object(
    'base_price', v_base,
    'multiplier', v_multiplier,
    'rush_fee', v_rush_fee,
    'final_price', v_final,
    'city', p_city,
    'demand_level', p_demand_level
  );
END;
$$;
