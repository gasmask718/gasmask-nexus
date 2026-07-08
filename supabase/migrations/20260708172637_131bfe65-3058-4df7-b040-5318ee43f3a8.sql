ALTER TABLE public.dc_phone_numbers
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS warming_until TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS warming_daily_cap INT NULL,
  ADD COLUMN IF NOT EXISTS warming_started_at TIMESTAMPTZ NULL;

CREATE OR REPLACE FUNCTION public.dc_phone_numbers_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dc_phone_numbers_touch_updated_at ON public.dc_phone_numbers;
CREATE TRIGGER trg_dc_phone_numbers_touch_updated_at
BEFORE UPDATE ON public.dc_phone_numbers
FOR EACH ROW EXECUTE FUNCTION public.dc_phone_numbers_touch_updated_at();

-- Partial index over the active warming subset (predicate must be IMMUTABLE, so no now())
CREATE INDEX IF NOT EXISTS idx_dc_phone_numbers_active_warming
  ON public.dc_phone_numbers (warming_until)
  WHERE status = 'active'
    AND is_active = true
    AND warming_until IS NOT NULL;

CREATE OR REPLACE FUNCTION public.number_can_dial_now(p_phone_number TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.dc_phone_numbers%ROWTYPE;
  v_calls_today INT;
BEGIN
  SELECT * INTO v_row
  FROM public.dc_phone_numbers
  WHERE phone_number = p_phone_number
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_row.status IS DISTINCT FROM 'active' OR v_row.is_active IS DISTINCT FROM TRUE THEN
    RETURN FALSE;
  END IF;

  IF v_row.warming_until IS NULL OR v_row.warming_until <= now() THEN
    RETURN TRUE;
  END IF;

  IF v_row.warming_daily_cap IS NULL THEN
    RETURN TRUE;
  END IF;

  BEGIN
    SELECT COUNT(*) INTO v_calls_today
    FROM public.dialer_call_attempts
    WHERE from_number = p_phone_number
      AND created_at >= date_trunc('day', now());
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    SELECT COUNT(*) INTO v_calls_today
    FROM public.ai_call_sessions
    WHERE from_number = p_phone_number
      AND created_at >= date_trunc('day', now());
  END;

  RETURN v_calls_today < v_row.warming_daily_cap;
END;
$$;

GRANT EXECUTE ON FUNCTION public.number_can_dial_now(TEXT) TO authenticated, service_role;