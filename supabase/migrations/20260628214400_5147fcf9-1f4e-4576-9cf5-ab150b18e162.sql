
-- Pre-clean: flip all already-past-expiry pending invites to expired so the new
-- partial unique index on (lower(email), company_id) WHERE status='pending'
-- can be created without violating uniqueness on stale duplicates.
UPDATE public.va_invites
   SET status = 'expired'
 WHERE status = 'pending' AND expires_at < now();

-- ============================================================
-- GAP 2 — va_invites schema extensions + unique constraints
-- ============================================================
ALTER TABLE public.va_invites
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS sent_to_email text,
  ADD COLUMN IF NOT EXISTS sent_to_phone text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'va_invites_channel_check'
      AND conrelid = 'public.va_invites'::regclass
  ) THEN
    ALTER TABLE public.va_invites
      ADD CONSTRAINT va_invites_channel_check
      CHECK (channel IN ('email','sms','both'));
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS va_invites_token_unique
  ON public.va_invites (token);

CREATE UNIQUE INDEX IF NOT EXISTS va_invites_email_company_pending_unique
  ON public.va_invites (lower(email), company_id)
  WHERE status = 'pending';

-- ============================================================
-- GAP 3 — va_invite_events audit table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.va_invite_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.va_invites(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN
    ('created','sent','opened','accepted','revoked','expired','send_failed')),
  actor_user_id uuid,
  channel text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS va_invite_events_invite_id_idx
  ON public.va_invite_events (invite_id, created_at DESC);

GRANT SELECT ON public.va_invite_events TO authenticated;
GRANT ALL ON public.va_invite_events TO service_role;

ALTER TABLE public.va_invite_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read VA invite events" ON public.va_invite_events;
CREATE POLICY "Admins read VA invite events"
  ON public.va_invite_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- No INSERT/UPDATE/DELETE policies: only SECURITY DEFINER helpers / service_role write.

-- ============================================================
-- Internal logger (SECURITY DEFINER, no grant to anon/authenticated)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_va_invite_event(
  p_invite_id uuid,
  p_event_type text,
  p_actor_user_id uuid DEFAULT NULL,
  p_channel text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.va_invite_events
    (invite_id, event_type, actor_user_id, channel, metadata)
  VALUES
    (p_invite_id, p_event_type, p_actor_user_id, p_channel, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.log_va_invite_event(uuid, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_va_invite_event(uuid, text, uuid, text, jsonb) TO service_role;

-- ============================================================
-- GAP 1 — accept_va_invite_atomic
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_va_invite_atomic(
  p_token text,
  p_accepting_user_id uuid,
  p_accepting_email text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- All-or-nothing writes (plpgsql function = implicit transaction; raise rolls back).
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

  INSERT INTO public.va_company_memberships
    (user_id, company_id, role, is_primary, is_active, created_by)
  VALUES
    (p_accepting_user_id, v_invite.company_id, v_invite.role, true, true, p_accepting_user_id)
  ON CONFLICT (user_id, company_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = true;

  -- Seed va_profiles (lightweight). va_permissions is intentionally NOT seeded:
  -- va_role enum has no sensible default, seeding would be a guess.
  -- TODO: seed va_permissions when admin chooses a permissions bundle in the UI.
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
$$;

REVOKE ALL ON FUNCTION public.accept_va_invite_atomic(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_va_invite_atomic(text, uuid, text) TO service_role;

-- ============================================================
-- GAP 3 — revoke_va_invite (admin only, logs event)
-- ============================================================
CREATE OR REPLACE FUNCTION public.revoke_va_invite(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_status text;
BEGIN
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin_required');
  END IF;

  SELECT status INTO v_status FROM public.va_invites WHERE id = p_invite_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invite_not_found');
  END IF;
  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invite_' || v_status);
  END IF;

  UPDATE public.va_invites SET status = 'revoked' WHERE id = p_invite_id;
  PERFORM public.log_va_invite_event(p_invite_id, 'revoked', v_caller, NULL, '{}'::jsonb);
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_va_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_va_invite(uuid) TO authenticated, service_role;

-- ============================================================
-- GAP 4 — expire_old_va_invites (cron target)
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_old_va_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT id FROM public.va_invites
     WHERE status = 'pending' AND expires_at < now()
  LOOP
    UPDATE public.va_invites SET status = 'expired' WHERE id = v_row.id;
    PERFORM public.log_va_invite_event(v_row.id, 'expired', NULL, NULL,
      jsonb_build_object('source', 'cron'));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_old_va_invites() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_old_va_invites() TO service_role;
