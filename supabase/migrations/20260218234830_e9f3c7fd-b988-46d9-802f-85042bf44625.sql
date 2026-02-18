
-- ═══════════════════════════════════════════════════════════════════
-- Phase 8: Portal Invites table + RLS + helpers
-- ═══════════════════════════════════════════════════════════════════

-- Create invite status enum
DO $$ BEGIN
  CREATE TYPE public.portal_invite_status AS ENUM ('active', 'revoked', 'expired', 'consumed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create portal_invites table
CREATE TABLE IF NOT EXISTS public.portal_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text UNIQUE NOT NULL,
  role public.app_role NOT NULL,
  email text,
  phone text,
  store_id uuid REFERENCES public.store_master(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  max_uses int NOT NULL DEFAULT 1,
  uses int NOT NULL DEFAULT 0,
  status public.portal_invite_status NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  consumed_by uuid,
  consumed_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portal_invites_token_hash ON public.portal_invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_portal_invites_status ON public.portal_invites(status);
CREATE INDEX IF NOT EXISTS idx_portal_invites_created_by ON public.portal_invites(created_by);

-- Enable RLS
ALTER TABLE public.portal_invites ENABLE ROW LEVEL SECURITY;

-- RLS: Only elevated users can view all invites
CREATE POLICY "Elevated users can view invites"
  ON public.portal_invites FOR SELECT
  USING (is_elevated_user(auth.uid()));

-- RLS: Only elevated users can create invites
CREATE POLICY "Elevated users can create invites"
  ON public.portal_invites FOR INSERT
  WITH CHECK (is_elevated_user(auth.uid()) AND auth.uid() = created_by);

-- RLS: Only elevated users can update invites (revoke)
CREATE POLICY "Elevated users can update invites"
  ON public.portal_invites FOR UPDATE
  USING (is_elevated_user(auth.uid()));

-- Add DELETE policy for portal_devices (admin revoke)
CREATE POLICY "Elevated users can delete devices"
  ON public.portal_devices FOR DELETE
  USING (is_elevated_user(auth.uid()));

-- Function to validate and redeem an invite (security definer, bypasses RLS)
CREATE OR REPLACE FUNCTION public.redeem_portal_invite(
  p_token_hash text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite portal_invites%ROWTYPE;
  v_result jsonb;
BEGIN
  -- Find the invite
  SELECT * INTO v_invite
  FROM portal_invites
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invite link');
  END IF;

  -- Check status
  IF v_invite.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite is no longer active');
  END IF;

  -- Check expiry
  IF v_invite.expires_at < now() THEN
    UPDATE portal_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'This invite has expired');
  END IF;

  -- Check uses
  IF v_invite.uses >= v_invite.max_uses THEN
    UPDATE portal_invites SET status = 'consumed' WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'This invite has been fully used');
  END IF;

  -- Redeem: increment uses
  UPDATE portal_invites
  SET uses = uses + 1,
      consumed_by = p_user_id,
      consumed_at = now(),
      status = CASE WHEN uses + 1 >= max_uses THEN 'consumed'::portal_invite_status ELSE 'active'::portal_invite_status END
  WHERE id = v_invite.id;

  -- Assign role to user (insert if not exists)
  INSERT INTO user_roles (user_id, role)
  VALUES (p_user_id, v_invite.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Log security event
  INSERT INTO portal_security_events (user_id, portal_type, event_type, severity, event_message, metadata)
  VALUES (
    p_user_id,
    v_invite.role::text,
    'invite_redeemed',
    'info',
    'User redeemed portal invite',
    jsonb_build_object('invite_id', v_invite.id, 'role', v_invite.role, 'store_id', v_invite.store_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'role', v_invite.role,
    'store_id', v_invite.store_id,
    'invite_id', v_invite.id
  );
END;
$$;
