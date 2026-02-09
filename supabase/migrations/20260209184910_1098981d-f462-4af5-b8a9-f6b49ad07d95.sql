
-- ============================================================
-- AMBASSADOR CONTROLLED INVITES — Database Layer
-- ============================================================

-- 1. Invite status enum
DO $$ BEGIN
  CREATE TYPE public.ambassador_invite_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. ambassador_invites table
CREATE TABLE IF NOT EXISTS public.ambassador_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_by_ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id),
  invited_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  invite_token TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  region_id UUID,
  status ambassador_invite_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  used_at TIMESTAMPTZ,
  used_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_ip TEXT,
  created_device_fingerprint TEXT,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id),
  revoke_reason TEXT,
  owner_approved_at TIMESTAMPTZ,
  owner_approved_by UUID REFERENCES auth.users(id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_ambassador_invites_token ON public.ambassador_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_ambassador_invites_token_hash ON public.ambassador_invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_ambassador_invites_status ON public.ambassador_invites(status);
CREATE INDEX IF NOT EXISTS idx_ambassador_invites_invited_by ON public.ambassador_invites(invited_by_ambassador_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_invites_expires ON public.ambassador_invites(expires_at) WHERE status = 'pending';

-- 4. RLS
ALTER TABLE public.ambassador_invites ENABLE ROW LEVEL SECURITY;

-- Ambassadors see their own invites
CREATE POLICY "ambassadors_own_invites" ON public.ambassador_invites
  FOR SELECT TO authenticated
  USING (invited_by_user_id = auth.uid());

-- Ambassadors can create invites
CREATE POLICY "ambassadors_create_invites" ON public.ambassador_invites
  FOR INSERT TO authenticated
  WITH CHECK (invited_by_user_id = auth.uid());

-- Owner/admin can see all invites
CREATE POLICY "admin_all_invites" ON public.ambassador_invites
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'owner')
  );

-- Owner/admin can update any invite (revoke, approve, etc.)
CREATE POLICY "admin_update_invites" ON public.ambassador_invites
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'owner')
  );

-- System can update invites (for acceptance flow)
CREATE POLICY "system_update_on_acceptance" ON public.ambassador_invites
  FOR UPDATE TO authenticated
  USING (invite_token IS NOT NULL);

-- 5. Audit events table for invites
CREATE TABLE IF NOT EXISTS public.ambassador_invite_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES public.ambassador_invites(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'sent', 'opened', 'accepted', 'expired', 'revoked', 'approved', 'extended')),
  actor_user_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ambassador_invite_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invite_events_read_own" ON public.ambassador_invite_events
  FOR SELECT TO authenticated
  USING (
    actor_user_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'owner')
  );

CREATE POLICY "invite_events_insert" ON public.ambassador_invite_events
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 6. Global invite toggle in system_settings
INSERT INTO public.system_settings (setting_key, setting_value)
VALUES ('ambassador_invites_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- 7. RPC: Create invite (server-side token generation + validation)
CREATE OR REPLACE FUNCTION public.create_ambassador_invite(
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_region_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ambassador_id UUID;
  v_user_id UUID := auth.uid();
  v_token TEXT;
  v_invite_id UUID;
  v_global_enabled BOOLEAN;
BEGIN
  -- Check global toggle
  SELECT (setting_value->>'enabled')::boolean INTO v_global_enabled
  FROM system_settings WHERE setting_key = 'ambassador_invites_enabled';
  
  IF NOT COALESCE(v_global_enabled, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ambassador invites are currently disabled');
  END IF;

  -- Get ambassador ID
  SELECT id INTO v_ambassador_id
  FROM ambassadors
  WHERE user_id = v_user_id AND is_active = true
  LIMIT 1;

  IF v_ambassador_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active ambassador profile found');
  END IF;

  -- Generate secure token
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Create invite
  INSERT INTO ambassador_invites (
    invited_by_ambassador_id, invited_by_user_id, invite_token, token_hash,
    email, phone, region_id
  ) VALUES (
    v_ambassador_id, v_user_id, v_token, encode(digest(v_token, 'sha256'), 'hex'),
    p_email, p_phone, p_region_id
  )
  RETURNING id INTO v_invite_id;

  -- Log audit event
  INSERT INTO ambassador_invite_events (invite_id, event_type, actor_user_id, metadata)
  VALUES (v_invite_id, 'created', v_user_id, jsonb_build_object('email', p_email, 'phone', p_phone));

  RETURN jsonb_build_object(
    'success', true,
    'invite_id', v_invite_id,
    'token', v_token,
    'expires_at', (now() + interval '48 hours')
  );
END;
$$;

-- 8. RPC: Validate invite token (for signup page)
CREATE OR REPLACE FUNCTION public.validate_ambassador_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- Auto-expire
    UPDATE ambassador_invites SET status = 'expired' WHERE id = v_invite.id AND status = 'pending';
    RETURN jsonb_build_object('valid', false, 'error', 'This invite has expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'invite_id', v_invite.id,
    'email', v_invite.email,
    'invited_by_ambassador_id', v_invite.invited_by_ambassador_id
  );
END;
$$;

-- 9. RPC: Accept invite (called after signup)
CREATE OR REPLACE FUNCTION public.accept_ambassador_invite(p_token TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_new_ambassador_id UUID;
BEGIN
  SELECT * INTO v_invite
  FROM ambassador_invites
  WHERE invite_token = p_token AND status = 'pending' AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite');
  END IF;

  -- Mark invite as accepted
  UPDATE ambassador_invites
  SET status = 'accepted', used_at = now(), used_by_user_id = p_user_id
  WHERE id = v_invite.id;

  -- Create ambassador record
  INSERT INTO ambassadors (user_id, recruited_by_ambassador_id, is_active, tracking_code)
  VALUES (p_user_id, v_invite.invited_by_ambassador_id, true, encode(gen_random_bytes(6), 'hex'))
  RETURNING id INTO v_new_ambassador_id;

  -- Assign ambassador role
  INSERT INTO user_roles (user_id, role)
  VALUES (p_user_id, 'ambassador')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Log audit event
  INSERT INTO ambassador_invite_events (invite_id, event_type, actor_user_id, metadata)
  VALUES (v_invite.id, 'accepted', p_user_id, jsonb_build_object('new_ambassador_id', v_new_ambassador_id));

  RETURN jsonb_build_object(
    'success', true,
    'ambassador_id', v_new_ambassador_id
  );
END;
$$;

-- 10. RPC: Revoke invite (owner/admin)
CREATE OR REPLACE FUNCTION public.revoke_ambassador_invite(p_invite_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_admin BOOLEAN;
BEGIN
  v_is_admin := has_role(v_user_id, 'admin') OR has_role(v_user_id, 'owner');
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admin/owner can revoke invites';
  END IF;

  UPDATE ambassador_invites
  SET status = 'revoked', revoked_at = now(), revoked_by = v_user_id, revoke_reason = p_reason
  WHERE id = p_invite_id AND status = 'pending';

  INSERT INTO ambassador_invite_events (invite_id, event_type, actor_user_id, metadata)
  VALUES (p_invite_id, 'revoked', v_user_id, jsonb_build_object('reason', p_reason));

  RETURN true;
END;
$$;

-- 11. Auto-expire trigger
CREATE OR REPLACE FUNCTION public.auto_expire_ambassador_invites()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ambassador_invites
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < now();
  RETURN NULL;
END;
$$;

-- Enable pgcrypto for digest function if not already
CREATE EXTENSION IF NOT EXISTS pgcrypto;
