
-- Number pool status enum
CREATE TYPE public.number_pool_status AS ENUM ('active', 'cooldown', 'flagged');
CREATE TYPE public.number_provider AS ENUM ('twilio', 'google');

-- Core number pool table
CREATE TABLE public.brandaro_number_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL UNIQUE,
  provider number_provider NOT NULL DEFAULT 'twilio',
  area_code text NOT NULL,
  state text,
  city text,
  assigned_to_va uuid REFERENCES public.profiles(id),
  is_active boolean NOT NULL DEFAULT true,
  daily_call_count int NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  risk_score int NOT NULL DEFAULT 0,
  status number_pool_status NOT NULL DEFAULT 'active',
  answer_rate numeric DEFAULT 0,
  total_calls int NOT NULL DEFAULT 0,
  total_answered int NOT NULL DEFAULT 0,
  total_conversions int NOT NULL DEFAULT 0,
  business_id uuid REFERENCES public.businesses(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brandaro_number_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read number pool"
  ON public.brandaro_number_pool FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage number pool"
  ON public.brandaro_number_pool FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Call outcome tracking per number
CREATE TABLE public.brandaro_call_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number_id uuid REFERENCES public.brandaro_number_pool(id) ON DELETE CASCADE NOT NULL,
  va_id uuid REFERENCES public.profiles(id),
  lead_phone text NOT NULL,
  lead_name text,
  lead_location text,
  area_code_matched boolean DEFAULT false,
  outcome text NOT NULL, -- no_answer, interested, not_interested, callback, do_not_call
  notes text,
  call_duration_seconds int,
  call_sid text,
  business_id uuid REFERENCES public.businesses(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brandaro_call_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read call outcomes"
  ON public.brandaro_call_outcomes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert call outcomes"
  ON public.brandaro_call_outcomes FOR INSERT TO authenticated WITH CHECK (true);

-- Number alerts table
CREATE TABLE public.brandaro_number_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number_id uuid REFERENCES public.brandaro_number_pool(id) ON DELETE CASCADE NOT NULL,
  alert_type text NOT NULL, -- 'limit_reached', 'flagged', 'spike'
  message text NOT NULL,
  acknowledged boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brandaro_number_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read number alerts"
  ON public.brandaro_number_alerts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage number alerts"
  ON public.brandaro_number_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Function: smart number assignment
CREATE OR REPLACE FUNCTION public.assign_best_number(
  p_target_area_code text,
  p_target_state text DEFAULT NULL,
  p_business_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number_id uuid;
BEGIN
  -- 1. Same area code, active, lowest usage
  SELECT id INTO v_number_id
  FROM brandaro_number_pool
  WHERE status = 'active'
    AND is_active = true
    AND daily_call_count < 75
    AND area_code = p_target_area_code
    AND (p_business_id IS NULL OR business_id = p_business_id)
  ORDER BY daily_call_count ASC, risk_score ASC, last_used_at ASC NULLS FIRST
  LIMIT 1;

  IF v_number_id IS NOT NULL THEN RETURN v_number_id; END IF;

  -- 2. Same state fallback
  IF p_target_state IS NOT NULL THEN
    SELECT id INTO v_number_id
    FROM brandaro_number_pool
    WHERE status = 'active'
      AND is_active = true
      AND daily_call_count < 75
      AND state = p_target_state
      AND (p_business_id IS NULL OR business_id = p_business_id)
    ORDER BY daily_call_count ASC, risk_score ASC
    LIMIT 1;

    IF v_number_id IS NOT NULL THEN RETURN v_number_id; END IF;
  END IF;

  -- 3. Any available number
  SELECT id INTO v_number_id
  FROM brandaro_number_pool
  WHERE status = 'active'
    AND is_active = true
    AND daily_call_count < 75
    AND (p_business_id IS NULL OR business_id = p_business_id)
  ORDER BY daily_call_count ASC, risk_score ASC
  LIMIT 1;

  RETURN v_number_id;
END;
$$;

-- Function: bump usage + enforce anti-ban
CREATE OR REPLACE FUNCTION public.bump_number_usage(p_number_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE brandaro_number_pool
  SET
    daily_call_count = daily_call_count + 1,
    total_calls = total_calls + 1,
    last_used_at = now(),
    risk_score = CASE WHEN daily_call_count >= 50 THEN risk_score + 1 ELSE risk_score END,
    status = CASE WHEN daily_call_count >= 74 THEN 'cooldown'::number_pool_status ELSE status END,
    updated_at = now()
  WHERE id = p_number_id;

  -- Alert if hitting limit
  IF (SELECT daily_call_count FROM brandaro_number_pool WHERE id = p_number_id) >= 70 THEN
    INSERT INTO brandaro_number_alerts (number_id, alert_type, message)
    VALUES (p_number_id, 'limit_reached',
      'Number approaching daily limit (' ||
      (SELECT daily_call_count FROM brandaro_number_pool WHERE id = p_number_id) || '/75)');
  END IF;
END;
$$;

-- Midnight reset cron (daily_call_count + cooldown recovery)
CREATE OR REPLACE FUNCTION public.reset_daily_number_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE brandaro_number_pool
  SET
    daily_call_count = 0,
    status = CASE
      WHEN status = 'cooldown' AND last_used_at < now() - interval '12 hours' THEN 'active'::number_pool_status
      ELSE status
    END,
    updated_at = now()
  WHERE status IN ('active', 'cooldown');
END;
$$;
