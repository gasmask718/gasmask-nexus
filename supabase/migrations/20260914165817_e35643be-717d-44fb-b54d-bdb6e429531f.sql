-- 1. TAXONOMY
CREATE TABLE public.recruiting_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruiting_categories TO authenticated;
GRANT ALL ON public.recruiting_categories TO service_role;
ALTER TABLE public.recruiting_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage recruiting categories" ON public.recruiting_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE TABLE public.recruiting_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.recruiting_categories(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  requires_license boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruiting_roles TO authenticated;
GRANT ALL ON public.recruiting_roles TO service_role;
ALTER TABLE public.recruiting_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage recruiting roles" ON public.recruiting_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

-- 2. CAMPAIGNS (recruitment ad / sourcing source)
CREATE TABLE public.recruiting_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  platform text,
  business_slug text,
  category_id uuid REFERENCES public.recruiting_categories(id) ON DELETE SET NULL,
  role_id uuid REFERENCES public.recruiting_roles(id) ON DELETE SET NULL,
  city text,
  state text,
  external_ad_id text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruiting_campaigns TO authenticated;
GRANT ALL ON public.recruiting_campaigns TO service_role;
ALTER TABLE public.recruiting_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage recruiting campaigns" ON public.recruiting_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

-- 3. CANONICAL APPLICANT IDENTITY
CREATE TABLE public.recruiting_applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  email_norm text GENERATED ALWAYS AS (nullif(lower(btrim(email)),'')) STORED,
  phone_last10 text GENERATED ALWAYS AS (
    nullif(right(regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g'), 10), '')
  ) STORED,
  city text,
  state text,
  country text,
  experience_summary text,
  qualifications text,
  license_info text,
  availability_summary text,
  notes text,
  review_status text NOT NULL DEFAULT 'new',
  call_status text NOT NULL DEFAULT 'not_called',
  onboarding_status text NOT NULL DEFAULT 'not_started',
  assigned_to uuid,
  last_contacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruiting_applicants TO authenticated;
GRANT ALL ON public.recruiting_applicants TO service_role;
ALTER TABLE public.recruiting_applicants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage recruiting applicants" ON public.recruiting_applicants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE UNIQUE INDEX recruiting_applicants_email_norm_key ON public.recruiting_applicants (email_norm) WHERE email_norm IS NOT NULL;
CREATE UNIQUE INDEX recruiting_applicants_phone_last10_key ON public.recruiting_applicants (phone_last10) WHERE phone_last10 IS NOT NULL;

-- 4. APPLICATIONS (one person -> many roles / businesses / campaigns)
CREATE TABLE public.recruiting_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.recruiting_applicants(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.recruiting_categories(id) ON DELETE RESTRICT,
  role_id uuid REFERENCES public.recruiting_roles(id) ON DELETE SET NULL,
  business_slug text,
  campaign_id uuid REFERENCES public.recruiting_campaigns(id) ON DELETE SET NULL,
  source_platform text,
  source_ad_id text,
  city text,
  state text,
  experience_summary text,
  license_info text,
  availability_summary text,
  application_status text NOT NULL DEFAULT 'applied',
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recruiting_applications TO authenticated;
GRANT ALL ON public.recruiting_applications TO service_role;
ALTER TABLE public.recruiting_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage recruiting applications" ON public.recruiting_applications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE UNIQUE INDEX recruiting_applications_dedupe_key ON public.recruiting_applications (
  applicant_id,
  category_id,
  coalesce(role_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(business_slug,''),
  coalesce(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid)
);
CREATE INDEX recruiting_applications_applicant_idx ON public.recruiting_applications (applicant_id);

-- 5. updated_at triggers
CREATE OR REPLACE FUNCTION public.recruiting_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_recruiting_categories_touch BEFORE UPDATE ON public.recruiting_categories FOR EACH ROW EXECUTE FUNCTION public.recruiting_touch_updated_at();
CREATE TRIGGER trg_recruiting_roles_touch BEFORE UPDATE ON public.recruiting_roles FOR EACH ROW EXECUTE FUNCTION public.recruiting_touch_updated_at();
CREATE TRIGGER trg_recruiting_campaigns_touch BEFORE UPDATE ON public.recruiting_campaigns FOR EACH ROW EXECUTE FUNCTION public.recruiting_touch_updated_at();
CREATE TRIGGER trg_recruiting_applicants_touch BEFORE UPDATE ON public.recruiting_applicants FOR EACH ROW EXECUTE FUNCTION public.recruiting_touch_updated_at();
CREATE TRIGGER trg_recruiting_applications_touch BEFORE UPDATE ON public.recruiting_applications FOR EACH ROW EXECUTE FUNCTION public.recruiting_touch_updated_at();

-- 6. SEED PARENT TAXONOMY
INSERT INTO public.recruiting_categories (slug, name, sort_order) VALUES
  ('specialty','Specialty',10),
  ('drivers','Drivers',20),
  ('chef','Chef',30),
  ('security','Security',40),
  ('beauty-massage','Beauty / Massage',50),
  ('event-staff','Event Staff',60),
  ('night-clubs','Night Clubs',70),
  ('jewelers','Jewelers',80),
  ('artist-live-auction','Artist / Live Auction',90),
  ('decorators-florist','Decorators / Florist',100),
  ('camera-team','Camera Team',110),
  ('wholesalers','Wholesalers',120),
  ('cleaners','Cleaners',130),
  ('service-providers','Service Providers',140);

-- 7. DEDUPE-SAFE INTAKE
CREATE OR REPLACE FUNCTION public.ingest_recruiting_applicant(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := nullif(lower(btrim(p_payload->>'email')),'');
  v_phone text := nullif(btrim(p_payload->>'phone'),'');
  v_last10 text := nullif(right(regexp_replace(coalesce(p_payload->>'phone',''),'[^0-9]','','g'),10),'');
  v_name text := nullif(btrim(p_payload->>'full_name'),'');
  v_category_id uuid;
  v_role_id uuid;
  v_campaign_id uuid;
  v_applicant_id uuid;
  v_application_id uuid;
  v_applicant_created boolean := false;
  v_application_created boolean := false;
BEGIN
  IF v_name IS NULL THEN RAISE EXCEPTION 'full_name is required'; END IF;
  IF v_email IS NULL AND v_last10 IS NULL THEN RAISE EXCEPTION 'email or phone is required'; END IF;

  -- resolve taxonomy
  IF p_payload ? 'category_slug' THEN
    SELECT id INTO v_category_id FROM recruiting_categories WHERE slug = p_payload->>'category_slug';
  ELSIF p_payload ? 'category_id' THEN
    v_category_id := (p_payload->>'category_id')::uuid;
  END IF;

  IF p_payload ? 'role_id' THEN
    v_role_id := (p_payload->>'role_id')::uuid;
  ELSIF p_payload ? 'role_slug' AND v_category_id IS NOT NULL THEN
    SELECT id INTO v_role_id FROM recruiting_roles WHERE category_id = v_category_id AND slug = p_payload->>'role_slug';
  END IF;

  IF v_category_id IS NULL AND v_role_id IS NOT NULL THEN
    SELECT category_id INTO v_category_id FROM recruiting_roles WHERE id = v_role_id;
  END IF;
  IF v_category_id IS NULL THEN RAISE EXCEPTION 'unknown recruiting category'; END IF;

  IF p_payload ? 'campaign_id' THEN
    v_campaign_id := (p_payload->>'campaign_id')::uuid;
  ELSIF p_payload ? 'campaign_code' THEN
    SELECT id INTO v_campaign_id FROM recruiting_campaigns WHERE code = p_payload->>'campaign_code';
  END IF;

  -- resolve canonical person: email first, then phone
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_applicant_id FROM recruiting_applicants WHERE email_norm = v_email;
  END IF;
  IF v_applicant_id IS NULL AND v_last10 IS NOT NULL THEN
    SELECT id INTO v_applicant_id FROM recruiting_applicants WHERE phone_last10 = v_last10;
  END IF;

  IF v_applicant_id IS NULL THEN
    INSERT INTO recruiting_applicants (
      full_name, email, phone, city, state, country,
      experience_summary, qualifications, license_info, availability_summary, notes
    ) VALUES (
      v_name, v_email, v_phone,
      nullif(btrim(p_payload->>'city'),''), nullif(btrim(p_payload->>'state'),''), nullif(btrim(p_payload->>'country'),''),
      nullif(btrim(p_payload->>'experience_summary'),''), nullif(btrim(p_payload->>'qualifications'),''),
      nullif(btrim(p_payload->>'license_info'),''), nullif(btrim(p_payload->>'availability_summary'),''),
      nullif(btrim(p_payload->>'notes'),'')
    ) RETURNING id INTO v_applicant_id;
    v_applicant_created := true;
  ELSE
    -- fill only blanks; never overwrite existing values
    UPDATE recruiting_applicants SET
      email = coalesce(email, v_email),
      phone = coalesce(phone, v_phone),
      city = coalesce(city, nullif(btrim(p_payload->>'city'),'')),
      state = coalesce(state, nullif(btrim(p_payload->>'state'),'')),
      country = coalesce(country, nullif(btrim(p_payload->>'country'),'')),
      experience_summary = coalesce(experience_summary, nullif(btrim(p_payload->>'experience_summary'),'')),
      qualifications = coalesce(qualifications, nullif(btrim(p_payload->>'qualifications'),'')),
      license_info = coalesce(license_info, nullif(btrim(p_payload->>'license_info'),'')),
      availability_summary = coalesce(availability_summary, nullif(btrim(p_payload->>'availability_summary'),''))
    WHERE id = v_applicant_id;
  END IF;

  INSERT INTO recruiting_applications (
    applicant_id, category_id, role_id, business_slug, campaign_id,
    source_platform, source_ad_id, city, state,
    experience_summary, license_info, availability_summary, payload
  ) VALUES (
    v_applicant_id, v_category_id, v_role_id,
    nullif(btrim(p_payload->>'business_slug'),''), v_campaign_id,
    nullif(btrim(p_payload->>'source_platform'),''), nullif(btrim(p_payload->>'source_ad_id'),''),
    nullif(btrim(p_payload->>'city'),''), nullif(btrim(p_payload->>'state'),''),
    nullif(btrim(p_payload->>'experience_summary'),''), nullif(btrim(p_payload->>'license_info'),''),
    nullif(btrim(p_payload->>'availability_summary'),''), p_payload
  )
  ON CONFLICT (applicant_id, category_id, coalesce(role_id,'00000000-0000-0000-0000-000000000000'::uuid), coalesce(business_slug,''), coalesce(campaign_id,'00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_application_id;

  v_application_created := v_applicant_created OR (SELECT created_at = updated_at FROM recruiting_applications WHERE id = v_application_id);

  RETURN jsonb_build_object(
    'applicant_id', v_applicant_id,
    'application_id', v_application_id,
    'applicant_created', v_applicant_created,
    'application_created', v_application_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ingest_recruiting_applicant(jsonb) TO authenticated, anon, service_role;

-- 8. REVIEW / CALL QUEUE VIEW
CREATE VIEW public.v_recruiting_applicant_queue
WITH (security_invoker = true) AS
SELECT
  a.id,
  a.full_name,
  a.email,
  a.phone,
  a.city,
  a.state,
  a.experience_summary,
  a.license_info,
  a.availability_summary,
  a.review_status,
  a.call_status,
  a.onboarding_status,
  a.assigned_to,
  a.last_contacted_at,
  a.created_at,
  a.updated_at,
  count(ap.id) AS application_count,
  array_remove(array_agg(DISTINCT c.slug), NULL) AS category_slugs,
  array_remove(array_agg(DISTINCT c.name), NULL) AS category_names,
  array_remove(array_agg(DISTINCT r.name), NULL) AS role_names,
  array_remove(array_agg(DISTINCT ap.business_slug), NULL) AS business_slugs,
  array_remove(array_agg(DISTINCT cp.code), NULL) AS campaign_codes,
  array_remove(array_agg(DISTINCT ap.source_platform), NULL) AS source_platforms
FROM public.recruiting_applicants a
LEFT JOIN public.recruiting_applications ap ON ap.applicant_id = a.id
LEFT JOIN public.recruiting_categories c ON c.id = ap.category_id
LEFT JOIN public.recruiting_roles r ON r.id = ap.role_id
LEFT JOIN public.recruiting_campaigns cp ON cp.id = ap.campaign_id
GROUP BY a.id;

GRANT SELECT ON public.v_recruiting_applicant_queue TO authenticated;
GRANT ALL ON public.v_recruiting_applicant_queue TO service_role;