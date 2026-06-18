
CREATE OR REPLACE FUNCTION public.validate_discount_code(p_code text, p_subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.discounts%ROWTYPE;
  amt numeric := 0;
BEGIN
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Enter a code');
  END IF;

  SELECT * INTO d
  FROM public.discounts
  WHERE upper(code) = upper(trim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Invalid discount code');
  END IF;
  IF NOT d.active THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This code is no longer active');
  END IF;
  IF d.expires_at IS NOT NULL AND d.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This code has expired');
  END IF;
  IF d.usage_limit IS NOT NULL AND d.used_count >= d.usage_limit THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This code has reached its usage limit');
  END IF;

  IF d.type = 'percent' THEN
    amt := round((COALESCE(p_subtotal,0) * d.value / 100.0)::numeric, 2);
  ELSE
    amt := LEAST(d.value, COALESCE(p_subtotal,0));
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', d.code,
    'type', d.type,
    'value', d.value,
    'discount_amount', amt,
    'message', 'Discount applied'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_discount_code(text, numeric) TO anon, authenticated, service_role;
