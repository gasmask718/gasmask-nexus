-- 1) Extend the existing request queue so it can carry referrals
ALTER TABLE public.ambassador_invite_requests ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.ambassador_invite_requests ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'ambassador_request';
ALTER TABLE public.ambassador_invite_requests ADD COLUMN IF NOT EXISTS show_review_notes boolean NOT NULL DEFAULT false;
ALTER TABLE public.ambassador_invite_requests ADD COLUMN IF NOT EXISTS resulting_ambassador_id uuid;
ALTER TABLE public.ambassador_invite_requests ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.ambassador_invite_requests ALTER COLUMN justification DROP NOT NULL;
ALTER TABLE public.ambassador_invite_requests DROP CONSTRAINT IF EXISTS ambassador_invite_requests_contact_check;
ALTER TABLE public.ambassador_invite_requests ADD CONSTRAINT ambassador_invite_requests_contact_check CHECK (email IS NOT NULL OR phone IS NOT NULL);

-- 2) Public referral submission → existing request table (no account needed)
CREATE OR REPLACE FUNCTION public.submit_ambassador_referral(
  p_referral_code text,
  p_full_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_referrer RECORD;
BEGIN
  IF p_email IS NULL AND p_phone IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'contact_required');
  END IF;

  SELECT id, user_id INTO v_referrer
  FROM ambassadors
  WHERE tracking_code = p_referral_code AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_referrer.user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_referral_code');
  END IF;

  -- Dedupe: same referrer already has a pending request for this contact
  IF EXISTS (
    SELECT 1 FROM ambassador_invite_requests r
    WHERE r.requested_by_ambassador_id = v_referrer.id
      AND r.status = 'pending'
      AND (
        (p_email IS NOT NULL AND r.email IS NOT NULL AND lower(r.email) = lower(p_email))
        OR (p_phone IS NOT NULL AND r.phone IS NOT NULL
            AND right(regexp_replace(r.phone, '\D', '', 'g'), 10) = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
            AND length(right(regexp_replace(p_phone, '\D', '', 'g'), 10)) >= 7)
      )
  ) THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true);
  END IF;

  INSERT INTO ambassador_invite_requests (
    full_name, email, phone, territory, justification,
    requested_by, requested_by_ambassador_id, source, status
  ) VALUES (
    p_full_name, p_email, p_phone, p_region,
    COALESCE(NULLIF(trim(p_notes), ''), 'Self-signup via referral link'),
    v_referrer.user_id, v_referrer.id, 'public_referral', 'pending'
  );

  RETURN jsonb_build_object('success', true, 'duplicate', false);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_ambassador_referral(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_ambassador_referral(text, text, text, text, text, text) TO anon, authenticated;

-- 3) Owner/admin review → creates invite with referral attribution + approval stamp
CREATE OR REPLACE FUNCTION public.review_ambassador_invite_request(
  p_request_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL,
  p_show_notes boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_req RECORD;
  v_token TEXT;
  v_invite_id UUID;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  SELECT * INTO v_req FROM ambassador_invite_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'request_not_found');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_reviewed');
  END IF;

  IF p_decision = 'decline' THEN
    IF p_notes IS NULL OR length(trim(p_notes)) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'reason_required');
    END IF;
    UPDATE ambassador_invite_requests
    SET status = 'rejected', reviewed_by = auth.uid(), review_notes = p_notes,
        show_review_notes = p_show_notes, updated_at = now()
    WHERE id = v_req.id;
    RETURN jsonb_build_object('success', true, 'decision', 'declined');
  END IF;

  IF p_decision <> 'approve' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_decision');
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO ambassador_invites (
    invited_by_ambassador_id, invited_by_user_id, invite_token, token_hash,
    email, phone, owner_approved_at, owner_approved_by
  ) VALUES (
    v_req.requested_by_ambassador_id, v_req.requested_by, v_token,
    encode(digest(v_token, 'sha256'), 'hex'),
    v_req.email, v_req.phone, now(), auth.uid()
  )
  RETURNING id INTO v_invite_id;

  UPDATE ambassador_invite_requests
  SET status = 'approved', reviewed_by = auth.uid(), review_notes = p_notes,
      show_review_notes = p_show_notes, generated_invite_id = v_invite_id, updated_at = now()
  WHERE id = v_req.id;

  INSERT INTO ambassador_invite_events (invite_id, event_type, actor_user_id, metadata) VALUES
    (v_invite_id, 'created', auth.uid(), jsonb_build_object('request_id', v_req.id, 'source', v_req.source)),
    (v_invite_id, 'owner_approved', auth.uid(), jsonb_build_object('request_id', v_req.id));

  RETURN jsonb_build_object(
    'success', true,
    'decision', 'approved',
    'invite_id', v_invite_id,
    'token', v_token
  );
END;
$$;
REVOKE ALL ON FUNCTION public.review_ambassador_invite_request(uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_ambassador_invite_request(uuid, text, text, boolean) TO authenticated;

-- 4) Fix staff self-attribution bug: staff-created invites get invited_by_ambassador_id = NULL,
--    never the target ambassador's own id
CREATE OR REPLACE FUNCTION public.create_ambassador_invite(p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_region_id uuid DEFAULT NULL::uuid, p_target_ambassador_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_ambassador_id UUID;
  v_user_id UUID := auth.uid();
  v_token TEXT;
  v_invite_id UUID;
  v_global_enabled BOOLEAN;
BEGIN
  SELECT (setting_value->>'enabled')::boolean INTO v_global_enabled
  FROM system_settings WHERE setting_key = 'ambassador_invites_enabled';

  IF NOT COALESCE(v_global_enabled, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ambassador invites are currently disabled');
  END IF;

  SELECT id INTO v_ambassador_id
  FROM ambassadors
  WHERE user_id = v_user_id AND is_active = true
  LIMIT 1;

  -- Allow staff to create invites even if they aren't an ambassador themselves
  IF v_ambassador_id IS NULL AND NOT public.is_staff(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active ambassador profile found');
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO ambassador_invites (
    invited_by_ambassador_id, invited_by_user_id, invite_token, token_hash,
    email, phone, region_id, target_ambassador_id
  ) VALUES (
    v_ambassador_id,  -- NULL for staff: no recruiter credit unless an ambassador created it
    v_user_id, v_token, encode(digest(v_token, 'sha256'), 'hex'),
    p_email, p_phone, p_region_id, p_target_ambassador_id
  )
  RETURNING id INTO v_invite_id;

  INSERT INTO ambassador_invite_events (invite_id, event_type, actor_user_id, metadata)
  VALUES (v_invite_id, 'created', v_user_id,
    jsonb_build_object('target_ambassador_id', p_target_ambassador_id));

  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite_id,
    'invite_token', v_token,
    'expires_at', (now() + interval '48 hours')
  );
END;
$function$;

-- 5) accept_ambassador_invite: owner-approval gate + back-link to the originating request
CREATE OR REPLACE FUNCTION public.accept_ambassador_invite(p_token text, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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

  -- Owner-approval gate: request/referral-originated invites must be approved before use
  IF v_invite.owner_approved_at IS NULL AND EXISTS (
    SELECT 1 FROM ambassador_invite_requests r WHERE r.generated_invite_id = v_invite.id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite is pending owner approval');
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

  -- Back-link the originating request (if any) so the referral tree stays intact
  UPDATE ambassador_invite_requests
  SET resulting_ambassador_id = v_ambassador_id, updated_at = now()
  WHERE generated_invite_id = v_invite.id AND resulting_ambassador_id IS NULL;

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
$function$;

-- 6) validate_ambassador_invite: same owner-approval gate (fail closed)
CREATE OR REPLACE FUNCTION public.validate_ambassador_invite(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite RECORD;
BEGIN
  SELECT * INTO v_invite
  FROM ambassador_invites
  WHERE invite_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid invite token');
  END IF;

  IF v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invite has been revoked');
  END IF;

  IF v_invite.status = 'accepted' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invite has already been used');
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE ambassador_invites SET status = 'expired' WHERE id = v_invite.id AND status = 'pending';
    RETURN jsonb_build_object('valid', false, 'error', 'This invite has expired');
  END IF;

  IF v_invite.owner_approved_at IS NULL AND EXISTS (
    SELECT 1 FROM ambassador_invite_requests r WHERE r.generated_invite_id = v_invite.id
  ) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invite is pending owner approval');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'invite_id', v_invite.id,
    'email', v_invite.email,
    'invited_by_ambassador_id', v_invite.invited_by_ambassador_id
  );
END;
$function$;

-- 7) Ambassador-initiated box requests live in the existing purchases table
CREATE POLICY "Ambassadors can create box requests"
ON public.ambassador_purchases FOR INSERT TO authenticated
WITH CHECK (
  status = 'requested'
  AND order_source = 'ambassador_request'
  AND ambassador_user_id = auth.uid()
  AND created_by_user_id = auth.uid()
);

CREATE POLICY "Ambassadors can add items to own box requests"
ON public.ambassador_purchase_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.ambassador_purchases ap
  WHERE ap.id = ambassador_purchase_items.purchase_id
    AND ap.ambassador_user_id = auth.uid()
    AND ap.status = 'requested'
));

-- 8) Remove yesterday's parallel tables and their review RPC (both empty, fully superseded)
DROP FUNCTION IF EXISTS public.review_ambassador_referral(uuid, text, text, boolean);
DROP TABLE IF EXISTS public.ambassador_referral_requests;
DROP TABLE IF EXISTS public.ambassador_box_requests;