CREATE TABLE public.ambassador_referral_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id),
  full_name text NOT NULL,
  email text,
  phone text,
  region text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  decline_reason text,
  show_decline_reason boolean NOT NULL DEFAULT false,
  invite_id uuid REFERENCES public.ambassador_invites(id),
  resulting_ambassador_id uuid REFERENCES public.ambassadors(id),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_amb_referral_requests_referrer ON public.ambassador_referral_requests (referrer_ambassador_id, status);

GRANT SELECT ON public.ambassador_referral_requests TO authenticated;
GRANT ALL ON public.ambassador_referral_requests TO service_role;

ALTER TABLE public.ambassador_referral_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ambassadors see own referrals" ON public.ambassador_referral_requests
  FOR SELECT TO authenticated
  USING (referrer_ambassador_id IN (SELECT id FROM public.ambassadors WHERE user_id = auth.uid()));

CREATE POLICY "Staff see all referrals" ON public.ambassador_referral_requests
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TRIGGER update_ambassador_referral_requests_updated_at
  BEFORE UPDATE ON public.ambassador_referral_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public helper: who does this referral code belong to? (first name only)
CREATE OR REPLACE FUNCTION public.get_ambassador_referrer_info(p_referral_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $func$
DECLARE
  v_name text;
  v_id uuid;
BEGIN
  SELECT id, COALESCE(NULLIF(name, ''), 'A GasMask ambassador')
    INTO v_id, v_name
  FROM public.ambassadors
  WHERE tracking_code = p_referral_code AND is_active = true
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_referral_code');
  END IF;

  RETURN jsonb_build_object('success', true, 'referrer_name', split_part(v_name, ' ', 1));
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_ambassador_referrer_info(text) TO anon, authenticated;

-- Public submission from the referral form (no account needed)
CREATE OR REPLACE FUNCTION public.submit_ambassador_referral(
  p_referral_code text,
  p_full_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $func$
DECLARE
  v_referrer uuid;
  v_id uuid;
BEGIN
  IF p_full_name IS NULL OR btrim(p_full_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'name_required');
  END IF;
  IF (p_email IS NULL OR btrim(p_email) = '') AND (p_phone IS NULL OR btrim(p_phone) = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'contact_required');
  END IF;

  SELECT id INTO v_referrer
  FROM public.ambassadors
  WHERE tracking_code = p_referral_code AND is_active = true
  LIMIT 1;

  IF v_referrer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_referral_code');
  END IF;

  -- Dedupe: same referrer + same email or phone already pending/approved
  SELECT id INTO v_id
  FROM public.ambassador_referral_requests
  WHERE referrer_ambassador_id = v_referrer
    AND status IN ('pending', 'approved')
    AND ((p_email IS NOT NULL AND btrim(p_email) <> '' AND lower(email) = lower(btrim(p_email)))
      OR (p_phone IS NOT NULL AND btrim(p_phone) <> '' AND phone = btrim(p_phone)))
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'request_id', v_id);
  END IF;

  INSERT INTO public.ambassador_referral_requests (
    referrer_ambassador_id, full_name, email, phone, region, notes
  ) VALUES (
    v_referrer,
    btrim(p_full_name),
    NULLIF(btrim(p_email), ''),
    NULLIF(btrim(p_phone), ''),
    NULLIF(btrim(p_region), ''),
    NULLIF(btrim(p_notes), '')
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'duplicate', false, 'request_id', v_id);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.submit_ambassador_referral(text, text, text, text, text, text) TO anon, authenticated;

-- Owner/admin review. Approve creates the invite stamped with the REFERRER's
-- ambassador id (attribution survives into accept_ambassador_invite path 3 and
-- now paths 1 & 2). Returns invite_id + token so the client can hand it to
-- send-ambassador-invite for SMS + email delivery.
CREATE OR REPLACE FUNCTION public.review_ambassador_referral(
  p_request_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL,
  p_show_reason boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $func$
DECLARE
  v_req RECORD;
  v_user uuid := auth.uid();
  v_token text;
  v_invite_id uuid;
BEGIN
  IF v_user IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user AND role IN ('owner'::app_role, 'admin'::app_role)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  SELECT * INTO v_req
  FROM public.ambassador_referral_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_reviewed');
  END IF;

  IF p_decision = 'decline' THEN
    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'reason_required');
    END IF;
    UPDATE public.ambassador_referral_requests
    SET status = 'declined',
        decline_reason = btrim(p_reason),
        show_decline_reason = p_show_reason,
        reviewed_by = v_user,
        reviewed_at = now()
    WHERE id = p_request_id;
    RETURN jsonb_build_object('success', true, 'status', 'declined');
  END IF;

  IF p_decision = 'approve' THEN
    v_token := encode(gen_random_bytes(32), 'hex');

    INSERT INTO public.ambassador_invites (
      invited_by_ambassador_id, invited_by_user_id, invite_token, token_hash,
      email, phone, expires_at
    ) VALUES (
      v_req.referrer_ambassador_id, v_user, v_token,
      encode(digest(v_token, 'sha256'), 'hex'),
      v_req.email, v_req.phone, now() + interval '48 hours'
    )
    RETURNING id INTO v_invite_id;

    INSERT INTO public.ambassador_invite_events (invite_id, event_type, actor_user_id, metadata)
    VALUES (v_invite_id, 'created', v_user, jsonb_build_object(
      'referral_request_id', p_request_id,
      'attributed_to_ambassador_id', v_req.referrer_ambassador_id
    ));

    UPDATE public.ambassador_referral_requests
    SET status = 'approved',
        invite_id = v_invite_id,
        reviewed_by = v_user,
        reviewed_at = now()
    WHERE id = p_request_id;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'approved',
      'invite_id', v_invite_id,
      'invite_token', v_token
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'invalid_decision');
END;
$func$;

GRANT EXECUTE ON FUNCTION public.review_ambassador_referral(uuid, text, text, boolean) TO authenticated;

-- Attribution fix: paths 1 & 2 previously never stamped recruited_by_ambassador_id.
CREATE OR REPLACE FUNCTION public.accept_ambassador_invite(p_token text, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $func$
DECLARE
  v_invite RECORD;
  v_ambassador_id UUID;
  v_action TEXT;
BEGIN
  SELECT * INTO v_invite
  FROM ambassador_invites
  WHERE invite_token = p_token AND status = 'pending' AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite');
  END IF;

  -- Path 1: explicit target stamped on invite
  IF v_invite.target_ambassador_id IS NOT NULL THEN
    UPDATE ambassadors
    SET user_id = p_user_id,
        is_active = true,
        recruited_by_ambassador_id = COALESCE(ambassadors.recruited_by_ambassador_id, v_invite.invited_by_ambassador_id),
        updated_at = now()
    WHERE id = v_invite.target_ambassador_id
    RETURNING id INTO v_ambassador_id;
    v_action := 'linked_target';
  END IF;

  -- Path 2: fuzzy match by email/phone on invite (only if no target hit)
  IF v_ambassador_id IS NULL AND (v_invite.email IS NOT NULL OR v_invite.phone IS NOT NULL) THEN
    UPDATE ambassadors
    SET user_id = p_user_id,
        is_active = true,
        recruited_by_ambassador_id = COALESCE(ambassadors.recruited_by_ambassador_id, v_invite.invited_by_ambassador_id),
        updated_at = now()
    WHERE id = (
      SELECT id FROM ambassadors
      WHERE (v_invite.email IS NOT NULL AND lower(email) = lower(v_invite.email))
         OR (v_invite.phone IS NOT NULL AND phone = v_invite.phone)
      ORDER BY created_at ASC
      LIMIT 1
    )
    RETURNING id INTO v_ambassador_id;
    IF v_ambassador_id IS NOT NULL THEN
      v_action := 'linked_match';
    END IF;
  END IF;

  -- Path 3: last resort — insert new
  IF v_ambassador_id IS NULL THEN
    INSERT INTO ambassadors (user_id, recruited_by_ambassador_id, is_active, tracking_code, email, phone)
    VALUES (p_user_id, v_invite.invited_by_ambassador_id, true,
            encode(gen_random_bytes(6), 'hex'), v_invite.email, v_invite.phone)
    RETURNING id INTO v_ambassador_id;
    v_action := 'created_new';
  END IF;

  UPDATE ambassador_invites
  SET status = 'accepted', used_at = now(), used_by_user_id = p_user_id
  WHERE id = v_invite.id;

  -- Back-link the referral request that produced this invite (if any)
  UPDATE ambassador_referral_requests
  SET resulting_ambassador_id = v_ambassador_id
  WHERE invite_id = v_invite.id AND resulting_ambassador_id IS NULL;

  INSERT INTO user_roles (user_id, role)
  VALUES (p_user_id, 'ambassador')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO ambassador_invite_events (invite_id, event_type, actor_user_id, metadata)
  VALUES (v_invite.id, 'accepted', p_user_id,
    jsonb_build_object('ambassador_id', v_ambassador_id, 'action', v_action,
      'attributed_to_ambassador_id', v_invite.invited_by_ambassador_id));

  RETURN jsonb_build_object(
    'success', true,
    'ambassador_id', v_ambassador_id,
    'action', v_action
  );
END;
$func$;