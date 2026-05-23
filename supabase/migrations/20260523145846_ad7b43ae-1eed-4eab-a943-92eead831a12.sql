
-- Per-driver tokens for magic-link accept
CREATE TABLE public.tt_dispatch_tokens (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL REFERENCES public.tt_dispatch_requests(id) ON DELETE CASCADE,
  partner_id text NOT NULL,
  partner_name text,
  partner_phone text,
  declined_at timestamptz,
  notified_taken_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dispatch_id, partner_id)
);

CREATE INDEX idx_tt_dispatch_tokens_dispatch ON public.tt_dispatch_tokens(dispatch_id);
CREATE INDEX idx_tt_dispatch_tokens_phone ON public.tt_dispatch_tokens(partner_phone);

ALTER TABLE public.tt_dispatch_tokens ENABLE ROW LEVEL SECURITY;

-- No public policies; only SECURITY DEFINER functions access this table.

-- Read job details by token (public — token is the auth)
CREATE OR REPLACE FUNCTION public.tt_get_dispatch_by_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  SELECT
    d.id            AS dispatch_id,
    d.status        AS dispatch_status,
    d.booking_id,
    d.booking_reference,
    d.service_type,
    d.service_category,
    d.pickup_location,
    d.dropoff_location,
    d.scheduled_at,
    d.special_requests,
    d.total_price,
    d.expires_at,
    d.accepted_partner_id,
    d.dispatch_pattern,
    t.partner_id,
    t.partner_name,
    t.declined_at
  INTO v_row
  FROM tt_dispatch_tokens t
  JOIN tt_dispatch_requests d ON d.id = t.dispatch_id
  WHERE t.token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'reason', 'invalid_token');
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'dispatch_id', v_row.dispatch_id,
    'dispatch_status', v_row.dispatch_status,
    'booking_id', v_row.booking_id,
    'booking_reference', v_row.booking_reference,
    'service_type', v_row.service_type,
    'service_category', v_row.service_category,
    'pickup_location', v_row.pickup_location,
    'dropoff_location', v_row.dropoff_location,
    'scheduled_at', v_row.scheduled_at,
    'special_requests', v_row.special_requests,
    'total_price', v_row.total_price,
    'expires_at', v_row.expires_at,
    'accepted_partner_id', v_row.accepted_partner_id,
    'dispatch_pattern', v_row.dispatch_pattern,
    'partner_id', v_row.partner_id,
    'partner_name', v_row.partner_name,
    'declined_at', v_row.declined_at,
    'is_winner', (v_row.accepted_partner_id IS NOT NULL AND v_row.accepted_partner_id = v_row.partner_id)
  );
END;
$$;

-- ATOMIC CLAIM — single conditional UPDATE; Postgres arbitrates the race.
CREATE OR REPLACE FUNCTION public.tt_claim_dispatch(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token record;
  v_updated_id uuid;
BEGIN
  SELECT dispatch_id, partner_id, partner_name, partner_phone
    INTO v_token
  FROM tt_dispatch_tokens
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'invalid', 'reason', 'token not found');
  END IF;

  -- The single arbitrating write. If status is anything other than 'sent', 0 rows update.
  UPDATE tt_dispatch_requests
     SET status = 'accepted',
         accepted_partner_id = v_token.partner_id,
         accepted_partner_name = v_token.partner_name,
         accepted_at = now()
   WHERE id = v_token.dispatch_id
     AND status = 'sent'
     AND (expires_at IS NULL OR expires_at > now())
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    -- Lost the race (or expired). Tell caller current state.
    RETURN jsonb_build_object(
      'outcome', 'lost',
      'dispatch_id', v_token.dispatch_id,
      'partner_id', v_token.partner_id,
      'reason', 'already_claimed_or_expired'
    );
  END IF;

  -- Won. Cascade to booking.
  UPDATE tt_bookings
     SET status = 'driver_assigned',
         assigned_partner_id = v_token.partner_id,
         updated_at = now()
   WHERE id = (SELECT booking_id FROM tt_dispatch_requests WHERE id = v_updated_id);

  RETURN jsonb_build_object(
    'outcome', 'won',
    'dispatch_id', v_updated_id,
    'partner_id', v_token.partner_id,
    'partner_name', v_token.partner_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.tt_decline_dispatch(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispatch_id uuid;
BEGIN
  UPDATE tt_dispatch_tokens
     SET declined_at = now()
   WHERE token = p_token AND declined_at IS NULL
  RETURNING dispatch_id INTO v_dispatch_id;

  IF v_dispatch_id IS NULL THEN
    RETURN jsonb_build_object('outcome', 'noop');
  END IF;

  RETURN jsonb_build_object('outcome', 'declined', 'dispatch_id', v_dispatch_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.tt_get_dispatch_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tt_claim_dispatch(uuid)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tt_decline_dispatch(uuid)       TO anon, authenticated;
