
-- Phase VI: Invite Lifecycle Observability & Control

-- 1. Add invite_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invite_status') THEN
    CREATE TYPE public.invite_status AS ENUM ('sent', 'accepted', 'expired', 'revoked');
  END IF;
END$$;

-- 2. Add lifecycle columns to user_invitations
ALTER TABLE public.user_invitations
  ADD COLUMN IF NOT EXISTS invite_status public.invite_status NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS accepted_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid,
  ADD COLUMN IF NOT EXISTS revoke_reason text;

-- 3. Backfill existing invitations
UPDATE public.user_invitations
SET invite_status = 'accepted'
WHERE accepted_at IS NOT NULL AND invite_status = 'sent';

UPDATE public.user_invitations
SET invite_status = 'expired'
WHERE expires_at < NOW() AND accepted_at IS NULL AND invite_status = 'sent';

-- 4. Create index for status queries
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON public.user_invitations(invite_status);
CREATE INDEX IF NOT EXISTS idx_user_invitations_accepted_user ON public.user_invitations(accepted_user_id);

-- 5. RPC: Revoke user access (non-destructive)
CREATE OR REPLACE FUNCTION public.revoke_user_access(
  _invite_id uuid,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite RECORD;
  _admin_id uuid;
  _result jsonb;
BEGIN
  _admin_id := auth.uid();
  
  -- Verify admin has elevated role
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _admin_id 
    AND role IN ('owner', 'admin', 'ceo')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to revoke access';
  END IF;

  -- Get the invite
  SELECT * INTO _invite FROM public.user_invitations WHERE id = _invite_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  -- Update invite status
  UPDATE public.user_invitations
  SET 
    invite_status = 'revoked',
    revoked_at = NOW(),
    revoked_by = _admin_id,
    revoke_reason = _reason
  WHERE id = _invite_id;

  -- Remove from user_roles if user had accepted
  IF _invite.accepted_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = _invite.accepted_user_id
    AND role = _invite.role;
  END IF;

  -- Log audit event
  INSERT INTO public.security_audit_log (
    user_id,
    event_type,
    event_severity,
    resource_type,
    resource_id,
    action,
    outcome,
    details
  ) VALUES (
    _admin_id,
    'access_revoked',
    'warning',
    'invitation',
    _invite_id::text,
    'revoke_access',
    'success',
    jsonb_build_object(
      'target_email', _invite.email,
      'target_user_id', _invite.accepted_user_id,
      'target_role', _invite.role::text,
      'reason', _reason,
      'timestamp', NOW()
    )
  );

  _result := jsonb_build_object(
    'success', true,
    'revoked_email', _invite.email,
    'revoked_role', _invite.role::text,
    'revoked_user_id', _invite.accepted_user_id
  );

  RETURN _result;
END;
$$;

-- 6. RPC: Reinstate revoked access
CREATE OR REPLACE FUNCTION public.reinstate_user_access(
  _invite_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite RECORD;
  _admin_id uuid;
BEGIN
  _admin_id := auth.uid();
  
  -- Verify admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _admin_id 
    AND role IN ('owner', 'admin', 'ceo')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  SELECT * INTO _invite FROM public.user_invitations WHERE id = _invite_id;
  
  IF NOT FOUND OR _invite.invite_status != 'revoked' THEN
    RAISE EXCEPTION 'Invitation not found or not in revoked state';
  END IF;

  -- Restore invite status to accepted
  UPDATE public.user_invitations
  SET 
    invite_status = 'accepted',
    revoked_at = NULL,
    revoked_by = NULL,
    revoke_reason = NULL
  WHERE id = _invite_id;

  -- Re-add role if user exists
  IF _invite.accepted_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, created_by)
    VALUES (_invite.accepted_user_id, _invite.role, _admin_id)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Audit log
  INSERT INTO public.security_audit_log (
    user_id,
    event_type,
    event_severity,
    resource_type,
    resource_id,
    action,
    outcome,
    details
  ) VALUES (
    _admin_id,
    'access_reinstated',
    'info',
    'invitation',
    _invite_id::text,
    'reinstate_access',
    'success',
    jsonb_build_object(
      'target_email', _invite.email,
      'target_user_id', _invite.accepted_user_id,
      'target_role', _invite.role::text,
      'timestamp', NOW()
    )
  );

  RETURN true;
END;
$$;
