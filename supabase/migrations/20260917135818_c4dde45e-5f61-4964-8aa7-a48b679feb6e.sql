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
  v_existing_user UUID;
  v_name TEXT;
  v_phone TEXT;
  v_user_email TEXT;
BEGIN
  SELECT * INTO v_invite
  FROM ambassador_invites
  WHERE invite_token = p_token AND status = 'pending' AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite');
  END IF;

  IF v_invite.owner_approved_at IS NULL AND EXISTS (
    SELECT 1 FROM ambassador_invite_requests r WHERE r.generated_invite_id = v_invite.id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite is pending owner approval');
  END IF;

  -- Email-bound invites may only be accepted by the invited address.
  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
  IF NULLIF(btrim(COALESCE(v_invite.email, '')), '') IS NOT NULL
     AND lower(btrim(COALESCE(v_user_email, ''))) <> lower(btrim(v_invite.email)) THEN
    RETURN jsonb_build_object('success', false,
      'error', 'This invite was sent to ' || v_invite.email ||
               '. Sign out and sign in (or sign up) with that email address to accept it.');
  END IF;

  -- Path 0: this login already owns an ambassador record — always reuse it.
  SELECT id INTO v_ambassador_id
  FROM ambassadors WHERE user_id = p_user_id ORDER BY created_at ASC LIMIT 1;
  IF v_ambassador_id IS NOT NULL THEN
    v_action := 'linked_existing_user';
  END IF;

  -- Path 1: explicit target stamped on invite (no phone lookup needed)
  IF v_ambassador_id IS NULL AND v_invite.target_ambassador_id IS NOT NULL THEN
    SELECT user_id INTO v_existing_user FROM ambassadors WHERE id = v_invite.target_ambassador_id;
    IF v_existing_user IS NOT NULL AND v_existing_user <> p_user_id THEN
      RETURN jsonb_build_object('success', false,
        'error', 'This invite is already linked to another account. Contact your administrator.');
    END IF;

    UPDATE ambassadors
    SET user_id = p_user_id,
        is_active = true,
        email = COALESCE(NULLIF(ambassadors.email, ''), v_invite.email),
        phone_primary = COALESCE(NULLIF(ambassadors.phone_primary, ''), v_invite.phone),
        recruited_by_ambassador_id = COALESCE(ambassadors.recruited_by_ambassador_id, v_invite.invited_by_ambassador_id),
        updated_at = now()
    WHERE id = v_invite.target_ambassador_id
    RETURNING id INTO v_ambassador_id;
    v_action := 'linked_target';
  END IF;

  -- Path 2: match by email/phone on invite (only if no target hit)
  IF v_ambassador_id IS NULL AND (v_invite.email IS NOT NULL OR v_invite.phone IS NOT NULL) THEN
    UPDATE ambassadors
    SET user_id = p_user_id,
        is_active = true,
        recruited_by_ambassador_id = COALESCE(ambassadors.recruited_by_ambassador_id, v_invite.invited_by_ambassador_id),
        updated_at = now()
    WHERE id = (
      SELECT id FROM ambassadors
      WHERE user_id IS NULL
        AND ((v_invite.email IS NOT NULL AND lower(email) = lower(v_invite.email))
          OR (v_invite.phone IS NOT NULL
              AND right(regexp_replace(COALESCE(phone_primary, personal_phone, phone_whatsapp, ''), '\D', '', 'g'), 10)
                = right(regexp_replace(v_invite.phone, '\D', '', 'g'), 10)
              AND length(regexp_replace(v_invite.phone, '\D', '', 'g')) >= 10))
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
    INSERT INTO ambassadors (user_id, recruited_by_ambassador_id, is_active, tracking_code, email, phone_primary)
    VALUES (p_user_id, v_invite.invited_by_ambassador_id, true,
            encode(gen_random_bytes(6), 'hex'), v_invite.email, v_invite.phone)
    RETURNING id INTO v_ambassador_id;
    v_action := 'created_new';
  END IF;

  UPDATE ambassador_invites
  SET status = 'accepted', used_at = now(), used_by_user_id = p_user_id
  WHERE id = v_invite.id;

  UPDATE ambassador_invite_requests
  SET resulting_ambassador_id = v_ambassador_id, updated_at = now()
  WHERE generated_invite_id = v_invite.id AND resulting_ambassador_id IS NULL;

  INSERT INTO user_roles (user_id, role)
  VALUES (p_user_id, 'ambassador')
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT COALESCE(NULLIF(a.name, ''), u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
         COALESCE(NULLIF(a.phone_primary, ''), NULLIF(a.personal_phone, ''), v_invite.phone)
    INTO v_name, v_phone
  FROM ambassadors a
  LEFT JOIN auth.users u ON u.id = p_user_id
  WHERE a.id = v_ambassador_id;

  INSERT INTO user_profiles (user_id, full_name, phone, primary_role)
  VALUES (p_user_id, v_name, v_phone, 'ambassador')
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = COALESCE(NULLIF(user_profiles.full_name, ''), EXCLUDED.full_name),
        phone = COALESCE(NULLIF(user_profiles.phone, ''), EXCLUDED.phone),
        -- Placeholder primary roles get promoted; real roles are preserved and
        -- ambassador is added alongside them.
        primary_role = CASE
          WHEN COALESCE(NULLIF(user_profiles.primary_role, ''), 'pending') IN ('pending', 'user', 'customer')
            THEN 'ambassador'
          ELSE user_profiles.primary_role
        END,
        extra_roles = CASE
          WHEN user_profiles.primary_role = 'ambassador' THEN user_profiles.extra_roles
          WHEN COALESCE(NULLIF(user_profiles.primary_role, ''), 'pending') IN ('pending', 'user', 'customer')
            THEN user_profiles.extra_roles
          WHEN 'ambassador' = ANY(COALESCE(user_profiles.extra_roles, '{}')) THEN user_profiles.extra_roles
          ELSE COALESCE(user_profiles.extra_roles, '{}') || ARRAY['ambassador']
        END,
        updated_at = now();

  INSERT INTO ambassador_invite_events (invite_id, event_type, actor_user_id, metadata)
  VALUES (v_invite.id, 'accepted', p_user_id,
    jsonb_build_object('ambassador_id', v_ambassador_id, 'action', v_action,
      'attributed_to_ambassador_id', v_invite.invited_by_ambassador_id));

  RETURN jsonb_build_object(
    'success', true,
    'ambassador_id', v_ambassador_id,
    'action', v_action,
    'redirect', '/ambassador'
  );
END;
$function$;

-- ---------------------------------------------------------------
-- One-off repair: QA-AMB-0917 wrongly linked to the Route Planner
-- trial account (fritzcadet498@gmail.com) during the manual test.
-- ---------------------------------------------------------------
UPDATE public.ambassadors
SET user_id = NULL, updated_at = now()
WHERE id = 'a373be62-55f1-452c-bbe2-eb023815654c'
  AND tracking_code = 'QA-AMB-0917'
  AND user_id = 'b461f472-51aa-40ee-ab2a-f9007a36387e';

DELETE FROM public.user_roles
WHERE user_id = 'b461f472-51aa-40ee-ab2a-f9007a36387e'
  AND role = 'ambassador';

UPDATE public.user_profiles
SET extra_roles = array_remove(COALESCE(extra_roles, '{}'), 'ambassador'),
    updated_at = now()
WHERE user_id = 'b461f472-51aa-40ee-ab2a-f9007a36387e';

UPDATE public.ambassador_invites
SET status = 'pending', used_at = NULL, used_by_user_id = NULL,
    expires_at = GREATEST(expires_at, now() + interval '14 days')
WHERE id = 'e3bcc916-bed3-4de6-aec4-b32f533176e5'
  AND target_ambassador_id = 'a373be62-55f1-452c-bbe2-eb023815654c'
  AND used_by_user_id = 'b461f472-51aa-40ee-ab2a-f9007a36387e';

INSERT INTO public.ambassador_invite_events (invite_id, event_type, actor_user_id, metadata)
VALUES ('e3bcc916-bed3-4de6-aec4-b32f533176e5', 'created', NULL,
  jsonb_build_object('reason', 'reopened_after_wrong_account_acceptance',
    'wrongly_accepted_by_user_id', 'b461f472-51aa-40ee-ab2a-f9007a36387e',
    'note', 'accepted while signed in as route planner trial account; detached and reopened'));