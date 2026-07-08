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

  SELECT COUNT(*) INTO v_calls_today
  FROM public.dc_call_logs
  WHERE from_number = p_phone_number
    AND created_at >= date_trunc('day', now());

  RETURN v_calls_today < v_row.warming_daily_cap;
END;
$$;