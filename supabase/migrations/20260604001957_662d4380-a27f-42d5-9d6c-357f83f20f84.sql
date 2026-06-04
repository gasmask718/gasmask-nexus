
-- Store applications: prospective stores apply via public site; admins approve into the system.
CREATE TABLE public.store_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  store_address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  ein TEXT,
  website TEXT,
  notes TEXT,
  source TEXT DEFAULT 'public_form',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','invited')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  applicant_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_store_id UUID,
  invite_id UUID REFERENCES public.invites(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.store_applications TO anon;
GRANT SELECT, INSERT, UPDATE ON public.store_applications TO authenticated;
GRANT ALL ON public.store_applications TO service_role;

ALTER TABLE public.store_applications ENABLE ROW LEVEL SECURITY;

-- Public can submit applications
CREATE POLICY "Anyone can submit a store application"
ON public.store_applications FOR INSERT
WITH CHECK (true);

-- Admins/owners manage all
CREATE POLICY "Admins manage store applications"
ON public.store_applications FOR ALL
TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner'));

-- Applicants can view their own application by email match (read-only, opaque to others)
CREATE POLICY "Applicants view own by email"
ON public.store_applications FOR SELECT
TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE INDEX idx_store_applications_status ON public.store_applications(status);
CREATE INDEX idx_store_applications_created ON public.store_applications(created_at DESC);

CREATE TRIGGER trg_store_applications_updated
BEFORE UPDATE ON public.store_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Approve RPC: marks approved + creates an invite token for the store role.
-- Returns invite token so caller can fire send-invite edge fn.
CREATE OR REPLACE FUNCTION public.approve_store_application(p_application_id UUID)
RETURNS TABLE(invite_id UUID, invite_token TEXT, application_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.store_applications%ROWTYPE;
  v_invite_id UUID;
  v_token TEXT;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_app FROM public.store_applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF v_app.status NOT IN ('pending','rejected') THEN
    RAISE EXCEPTION 'Application already %', v_app.status;
  END IF;

  INSERT INTO public.invites (role, target_link, invited_by, channel, sent_to_email, sent_to_phone, sent_name, message_preview, status)
  VALUES (
    'store',
    jsonb_build_object('application_id', p_application_id, 'business_name', v_app.business_name),
    auth.uid(),
    CASE WHEN v_app.phone IS NOT NULL THEN 'both' ELSE 'email' END,
    v_app.email,
    v_app.phone,
    COALESCE(v_app.contact_name, v_app.business_name),
    'Welcome — your Dynasty Direct store account is approved.',
    'sent'
  )
  RETURNING id, token INTO v_invite_id, v_token;

  UPDATE public.store_applications
  SET status = 'invited',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      invite_id = v_invite_id,
      updated_at = now()
  WHERE id = p_application_id;

  RETURN QUERY SELECT v_invite_id, v_token, p_application_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_store_application(p_application_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.store_applications
  SET status = 'rejected',
      rejection_reason = p_reason,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_application_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_store_application(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_store_application(UUID, TEXT) TO authenticated;
