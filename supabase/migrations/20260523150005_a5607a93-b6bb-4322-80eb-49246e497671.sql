
CREATE OR REPLACE FUNCTION public.tt_claim_dispatch(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token record;
  v_updated_id uuid;
  v_booking_id uuid;
  v_driver_uuid uuid;
BEGIN
  SELECT dispatch_id, partner_id, partner_name, partner_phone
    INTO v_token
  FROM tt_dispatch_tokens
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'invalid', 'reason', 'token not found');
  END IF;

  -- THE atomic claim. Race-arbitrated by Postgres row lock.
  UPDATE tt_dispatch_requests
     SET status = 'accepted',
         accepted_partner_id = v_token.partner_id,
         accepted_partner_name = v_token.partner_name,
         accepted_at = now()
   WHERE id = v_token.dispatch_id
     AND status = 'sent'
     AND (expires_at IS NULL OR expires_at > now())
  RETURNING id, booking_id INTO v_updated_id, v_booking_id;

  IF v_updated_id IS NULL THEN
    RETURN jsonb_build_object(
      'outcome', 'lost',
      'dispatch_id', v_token.dispatch_id,
      'partner_id', v_token.partner_id,
      'reason', 'already_claimed_or_expired'
    );
  END IF;

  -- Best-effort uuid cast of the token partner id
  BEGIN
    v_driver_uuid := v_token.partner_id::uuid;
  EXCEPTION WHEN others THEN
    v_driver_uuid := NULL;
  END;

  UPDATE tt_bookings
     SET status = 'driver_assigned',
         driver_id = COALESCE(v_driver_uuid, driver_id),
         updated_at = now()
   WHERE id = v_booking_id;

  RETURN jsonb_build_object(
    'outcome', 'won',
    'dispatch_id', v_updated_id,
    'booking_id', v_booking_id,
    'partner_id', v_token.partner_id,
    'partner_name', v_token.partner_name
  );
END;
$$;
