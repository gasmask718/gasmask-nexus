CREATE OR REPLACE FUNCTION public.accept_va_invite_atomic(p_token text, p_accepting_user_id uuid, p_accepting_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite RECORD;
BEGIN
  IF p_token IS NULL OR p_accepting_user_id IS NULL OR p_accepting_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_arguments');
  END IF;

  SELECT id, email, company_id, role, status, expires_at
    INTO v_invite
    FROM public.va_invites
   WHERE token = p_token
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invite_not_found');
  END IF;

  IF v_invite.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invite_' || v_invite.status);
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.va_invites SET status = 'expired' WHERE id = v_invite.id;
    PERFORM public.log_va_invite_event(v_invite.id, 'expired', NULL, NULL, '{}'::jsonb);
    RETURN jsonb_build_object('success', false, 'error', 'invite_expired');
  END IF;

  IF lower(v_invite.email) <> lower(p_accepting_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'email_mismatch');
  END IF;

  INSERT INTO public.user_profiles (user_id, primary_role)
  VALUES (p_accepting_user_id, 'va')
  ON CONFLICT (user_id) DO UPDATE
    SET primary_role = COALESCE(public.user_profiles.primary_role, 'va');

  INSERT INTO public.user_roles (user_id, role)
  SELECT p_accepting_user_id, 'va'::app_role
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = p_accepting_user_id AND role = 'va'::app_role
  );

  -- Multi-company invites ADD a membership. is_primary only when the VA has no
  -- other active primary membership — the first company stays their home base.
  INSERT INTO public.va_company_memberships
    (user_id, company_id, role, is_primary, is_active, created_by)
  VALUES
    (p_accepting_user_id, v_invite.company_id, v_invite.role,
     NOT EXISTS (
       SELECT 1 FROM public.va_company_memberships
        WHERE user_id = p_accepting_user_id AND is_primary AND is_active
     ),
     true, p_accepting_user_id)
  ON CONFLICT (user_id, company_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = true;

  INSERT INTO public.va_profiles (user_id, label)
  VALUES (p_accepting_user_id, 'VA')
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.va_invites
     SET status = 'accepted',
         accepted_by = p_accepting_user_id,
         accepted_at = now()
   WHERE id = v_invite.id;

  PERFORM public.log_va_invite_event(
    v_invite.id, 'accepted', p_accepting_user_id, NULL,
    jsonb_build_object('company_id', v_invite.company_id, 'role', v_invite.role)
  );

  RETURN jsonb_build_object(
    'success', true,
    'va_user_id', p_accepting_user_id,
    'company_id', v_invite.company_id,
    'role', v_invite.role
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$function$;