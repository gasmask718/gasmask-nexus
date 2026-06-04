
-- Universal Invites: one table, role-aware, pre-linkage to target records
CREATE TABLE IF NOT EXISTS public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'base64'),
  role app_role NOT NULL,
  target_link JSONB NOT NULL DEFAULT '{}'::jsonb,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'sms',
  sent_to_phone TEXT,
  sent_to_email TEXT,
  sent_name TEXT,
  message_preview TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  accepted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  send_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invites_status_check CHECK (status IN ('sent','opened','accepted','expired','revoked')),
  CONSTRAINT invites_channel_check CHECK (channel IN ('sms','email','both','link'))
);

CREATE INDEX IF NOT EXISTS invites_status_idx ON public.invites(status);
CREATE INDEX IF NOT EXISTS invites_role_idx ON public.invites(role);
CREATE INDEX IF NOT EXISTS invites_created_idx ON public.invites(created_at DESC);

GRANT SELECT ON public.invites TO anon;
GRANT SELECT, INSERT, UPDATE ON public.invites TO authenticated;
GRANT ALL ON public.invites TO service_role;

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Anyone can read by token (validation on accept page is public)
CREATE POLICY "Public can read invites by token" ON public.invites
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins & owners manage invites" ON public.invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Inviter sees own invites" ON public.invites
  FOR SELECT TO authenticated USING (invited_by = auth.uid());

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_invites_updated ON public.invites;
CREATE TRIGGER trg_invites_updated BEFORE UPDATE ON public.invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RPC: create_invite
CREATE OR REPLACE FUNCTION public.create_invite(
  p_role app_role,
  p_target_link JSONB DEFAULT '{}'::jsonb,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT 'sms'
) RETURNS public.invites
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.invites;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  INSERT INTO public.invites (role, target_link, invited_by, channel, sent_to_phone, sent_to_email, sent_name)
  VALUES (p_role, COALESCE(p_target_link,'{}'::jsonb), auth.uid(), COALESCE(p_channel,'sms'), p_phone, p_email, p_name)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- RPC: accept_invite — called AFTER auth signup; grants role + links target record
CREATE OR REPLACE FUNCTION public.accept_invite(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invite public.invites;
  v_uid UUID := auth.uid();
  v_target JSONB;
  v_redirect TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth_required');
  END IF;

  SELECT * INTO v_invite FROM public.invites WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;
  IF v_invite.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_accepted');
  END IF;
  IF v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'revoked');
  END IF;
  IF v_invite.expires_at < now() THEN
    UPDATE public.invites SET status='expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  -- Grant role
  INSERT INTO public.user_roles (user_id, role, role_name, created_by)
  VALUES (v_uid, v_invite.role, v_invite.role::text, v_invite.invited_by)
  ON CONFLICT DO NOTHING;

  v_target := v_invite.target_link;

  -- Role-specific linkage
  IF v_invite.role = 'wholesaler' AND (v_target ? 'wholesaler_profile_id') THEN
    UPDATE public.wholesaler_profiles
       SET user_id = v_uid, status = 'active'
     WHERE id = (v_target->>'wholesaler_profile_id')::uuid;
    v_redirect := '/portals/wholesaler';
  ELSIF v_invite.role = 'wholesaler' THEN
    -- Create a fresh wholesaler_profile
    INSERT INTO public.wholesaler_profiles (user_id, company_name, contact_name, phone, email, status)
    VALUES (v_uid, COALESCE(v_target->>'company_name', v_invite.sent_name, 'New Wholesaler'),
            v_invite.sent_name, v_invite.sent_to_phone, v_invite.sent_to_email, 'active')
    ON CONFLICT DO NOTHING;
    v_redirect := '/portals/wholesaler';
  ELSIF v_invite.role = 'ambassador' THEN
    INSERT INTO public.ambassador_profiles (user_id) VALUES (v_uid) ON CONFLICT DO NOTHING;
    v_redirect := '/ambassador/dashboard';
  ELSIF v_invite.role = 'store' THEN
    -- store_master has no owner column; we record linkage via target_link & user_roles only
    v_redirect := '/portals/store';
  ELSIF v_invite.role = 'customer' THEN
    v_redirect := '/account';
  ELSE
    v_redirect := '/';
  END IF;

  UPDATE public.invites
     SET status='accepted', accepted_user_id = v_uid, accepted_at = now()
   WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'role', v_invite.role,
    'redirect', v_redirect,
    'target_link', v_target
  );
END $$;

-- RPC: mark opened (public, by token)
CREATE OR REPLACE FUNCTION public.mark_invite_opened(p_token TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.invites SET status='opened', opened_at=COALESCE(opened_at, now())
   WHERE token=p_token AND status='sent';
$$;

-- RPC: revoke
CREATE OR REPLACE FUNCTION public.revoke_invite(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.invites SET status='revoked' WHERE id = p_id AND status NOT IN ('accepted');
END $$;

GRANT EXECUTE ON FUNCTION public.create_invite(app_role, jsonb, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invite_opened(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_invite(uuid) TO authenticated;
