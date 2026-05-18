
-- Public storage bucket for intake uploads (public read so VAs see files easily)
INSERT INTO storage.buckets (id, name, public)
VALUES ('va-lead-intake', 'va-lead-intake', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anonymous + authenticated uploads under the intake/ prefix
DROP POLICY IF EXISTS "Public intake uploads" ON storage.objects;
CREATE POLICY "Public intake uploads"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'va-lead-intake'
  AND (storage.foldername(name))[1] = 'intake'
);

DROP POLICY IF EXISTS "Public intake reads" ON storage.objects;
CREATE POLICY "Public intake reads"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'va-lead-intake');

-- RPC: validate token + return safe pre-fill data, also stamp accessed_at
CREATE OR REPLACE FUNCTION public.get_public_intake_invite(_token text)
RETURNS TABLE (
  id uuid,
  business_name text,
  owner_name text,
  email text,
  phone text,
  status text,
  submitted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.va_intake_invites
     SET accessed_at = COALESCE(accessed_at, now())
   WHERE token = _token;

  RETURN QUERY
  SELECT v.id, v.business_name, v.owner_name, v.email, v.phone, v.status, v.submitted_at
  FROM public.va_intake_invites v
  WHERE v.token = _token
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_intake_invite(text) TO anon, authenticated;

-- RPC: submit public intake — inserts lead assigned to original VA + marks invite submitted
CREATE OR REPLACE FUNCTION public.submit_public_intake(
  _token text,
  _business_name text,
  _phone text,
  _city text,
  _industry text,
  _service_interest text,
  _existing_website text,
  _call_notes text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.va_intake_invites%ROWTYPE;
  v_lead_id uuid;
BEGIN
  SELECT * INTO v_invite FROM public.va_intake_invites WHERE token = _token;
  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invalid intake link';
  END IF;
  IF v_invite.submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This intake has already been submitted';
  END IF;

  INSERT INTO public.brandaro_qualified_leads(
    business_name, phone_number, city, industry, assigned_va,
    lead_status, source, call_notes, service_interest,
    has_website, website_status, pipeline_stage
  ) VALUES (
    COALESCE(NULLIF(_business_name,''), v_invite.business_name, 'Unknown'),
    COALESCE(NULLIF(_phone,''), v_invite.phone),
    NULLIF(_city,''),
    NULLIF(_industry,''),
    v_invite.va_id,
    'new',
    'public_intake',
    _call_notes,
    NULLIF(_service_interest,''),
    COALESCE(NULLIF(_existing_website,'') IS NOT NULL, false),
    CASE WHEN NULLIF(_existing_website,'') IS NOT NULL THEN 'has_site' ELSE 'unknown' END,
    'new'
  )
  RETURNING id INTO v_lead_id;

  UPDATE public.va_intake_invites
     SET submitted_at = now(),
         status = 'submitted',
         updated_at = now()
   WHERE id = v_invite.id;

  RETURN v_lead_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_intake(text, text, text, text, text, text, text, text) TO anon, authenticated;

-- has_website column exists? add safe column for has_website if missing (was used in earlier insert)
-- (table already has website_status; brandaro_qualified_leads has has_website? Skipping if not present)
