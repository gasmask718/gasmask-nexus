
-- 1. Add target_ambassador_id column for explicit linkage
ALTER TABLE public.ambassador_invites
  ADD COLUMN IF NOT EXISTS target_ambassador_id UUID REFERENCES public.ambassadors(id);

CREATE INDEX IF NOT EXISTS idx_ambassador_invites_target
  ON public.ambassador_invites(target_ambassador_id)
  WHERE target_ambassador_id IS NOT NULL;

-- 2. Extend create_ambassador_invite to accept optional target
CREATE OR REPLACE FUNCTION public.create_ambassador_invite(
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_region_id uuid DEFAULT NULL,
  p_target_ambassador_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    COALESCE(v_ambassador_id, (SELECT id FROM ambassadors WHERE id = p_target_ambassador_id)),
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

-- 3. Rewrite accept_ambassador_invite: target → match → insert fallback
CREATE OR REPLACE FUNCTION public.accept_ambassador_invite(p_token text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Path 1: explicit target stamped on invite
  IF v_invite.target_ambassador_id IS NOT NULL THEN
    UPDATE ambassadors
    SET user_id = p_user_id, is_active = true, updated_at = now()
    WHERE id = v_invite.target_ambassador_id
    RETURNING id INTO v_ambassador_id;
    v_action := 'linked_target';
  END IF;

  -- Path 2: fuzzy match by email/phone on invite (only if no target hit)
  IF v_ambassador_id IS NULL AND (v_invite.email IS NOT NULL OR v_invite.phone IS NOT NULL) THEN
    UPDATE ambassadors
    SET user_id = p_user_id, is_active = true, updated_at = now()
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

  INSERT INTO user_roles (user_id, role)
  VALUES (p_user_id, 'ambassador')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO ambassador_invite_events (invite_id, event_type, actor_user_id, metadata)
  VALUES (v_invite.id, 'accepted', p_user_id,
    jsonb_build_object('ambassador_id', v_ambassador_id, 'action', v_action));

  RETURN jsonb_build_object(
    'success', true,
    'ambassador_id', v_ambassador_id,
    'action', v_action
  );
END;
$function$;
