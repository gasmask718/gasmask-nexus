-- 1. Instagram identity on the canonical applicant
ALTER TABLE public.recruiting_applicants ADD COLUMN IF NOT EXISTS instagram_username text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_recruiting_applicants_instagram
  ON public.recruiting_applicants (lower(instagram_username))
  WHERE instagram_username IS NOT NULL;

-- 2. Intake accepts instagram as an identity key (email -> phone -> instagram)
CREATE OR REPLACE FUNCTION public.ingest_recruiting_applicant(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := nullif(lower(btrim(p_payload->>'email')),'');
  v_phone text := nullif(btrim(p_payload->>'phone'),'');
  v_last10 text := nullif(right(regexp_replace(coalesce(p_payload->>'phone',''),'[^0-9]','','g'),10),'');
  v_name text := nullif(btrim(p_payload->>'full_name'),'');
  v_ig text := nullif(lower(btrim(regexp_replace(coalesce(p_payload->>'instagram_username',''),'^@+',''))),'');
  v_category_id uuid;
  v_role_id uuid;
  v_campaign_id uuid;
  v_applicant_id uuid;
  v_application_id uuid;
  v_applicant_created boolean := false;
  v_application_created boolean := false;
BEGIN
  IF v_name IS NULL THEN RAISE EXCEPTION 'full_name is required'; END IF;
  IF v_email IS NULL AND v_last10 IS NULL AND v_ig IS NULL THEN
    RAISE EXCEPTION 'email, phone or instagram_username is required';
  END IF;

  IF p_payload ? 'category_slug' THEN
    SELECT id INTO v_category_id FROM recruiting_categories WHERE slug = p_payload->>'category_slug';
  ELSIF p_payload ? 'category_id' THEN
    v_category_id := (p_payload->>'category_id')::uuid;
  END IF;

  IF p_payload ? 'role_id' THEN
    v_role_id := (p_payload->>'role_id')::uuid;
  ELSIF p_payload ? 'role_slug' AND v_category_id IS NOT NULL THEN
    SELECT id INTO v_role_id FROM recruiting_roles WHERE category_id = v_category_id AND slug = p_payload->>'role_slug';
  ELSIF p_payload ? 'role_slug' THEN
    SELECT id INTO v_role_id FROM recruiting_roles WHERE slug = p_payload->>'role_slug' AND is_active LIMIT 1;
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

  IF v_email IS NOT NULL THEN
    SELECT id INTO v_applicant_id FROM recruiting_applicants WHERE email_norm = v_email;
  END IF;
  IF v_applicant_id IS NULL AND v_last10 IS NOT NULL THEN
    SELECT id INTO v_applicant_id FROM recruiting_applicants WHERE phone_last10 = v_last10;
  END IF;
  IF v_applicant_id IS NULL AND v_ig IS NOT NULL THEN
    SELECT id INTO v_applicant_id FROM recruiting_applicants WHERE lower(instagram_username) = v_ig;
  END IF;

  IF v_applicant_id IS NULL THEN
    INSERT INTO recruiting_applicants (
      full_name, email, phone, instagram_username, city, state, country,
      experience_summary, qualifications, license_info, availability_summary, notes
    ) VALUES (
      v_name, v_email, v_phone, v_ig,
      nullif(btrim(p_payload->>'city'),''), nullif(btrim(p_payload->>'state'),''), nullif(btrim(p_payload->>'country'),''),
      nullif(btrim(p_payload->>'experience_summary'),''), nullif(btrim(p_payload->>'qualifications'),''),
      nullif(btrim(p_payload->>'license_info'),''), nullif(btrim(p_payload->>'availability_summary'),''),
      nullif(btrim(p_payload->>'notes'),'')
    ) RETURNING id INTO v_applicant_id;
    v_applicant_created := true;
  ELSE
    UPDATE recruiting_applicants SET
      email = coalesce(email, v_email),
      phone = coalesce(phone, v_phone),
      instagram_username = coalesce(instagram_username, v_ig),
      city = coalesce(city, nullif(btrim(p_payload->>'city'),'')),
      state = coalesce(state, nullif(btrim(p_payload->>'state'),'')),
      country = coalesce(country, nullif(btrim(p_payload->>'country'),'')),
      experience_summary = coalesce(experience_summary, nullif(btrim(p_payload->>'experience_summary'),'')),
      qualifications = coalesce(qualifications, nullif(btrim(p_payload->>'qualifications'),'')),
      license_info = coalesce(license_info, nullif(btrim(p_payload->>'license_info'),'')),
      availability_summary = coalesce(availability_summary, nullif(btrim(p_payload->>'availability_summary'),''))
    WHERE id = v_applicant_id;
  END IF;

  SELECT id INTO v_application_id FROM recruiting_applications
   WHERE applicant_id = v_applicant_id
     AND category_id = v_category_id
     AND role_id IS NOT DISTINCT FROM v_role_id
     AND business_slug IS NOT DISTINCT FROM nullif(btrim(p_payload->>'business_slug'),'')
     AND campaign_id IS NOT DISTINCT FROM v_campaign_id
   LIMIT 1;

  IF v_application_id IS NULL THEN
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
    ) RETURNING id INTO v_application_id;
    v_application_created := true;
  END IF;

  RETURN jsonb_build_object(
    'applicant_id', v_applicant_id,
    'application_id', v_application_id,
    'applicant_created', v_applicant_created,
    'application_created', v_application_created
  );
END $function$;

-- 3. Creator-lane roles + one Playboxxx sourcing campaign
INSERT INTO public.recruiting_roles (category_id, slug, name, sort_order)
SELECT c.id, v.slug, v.name, v.ord
FROM (VALUES
  ('camera-team','photographer','Photographer',10),
  ('camera-team','cameraman','Cameraman',20),
  ('camera-team','videographer','Videographer',30),
  ('specialty','model','Model',10),
  ('specialty','content-creator','Content Creator',20)
) AS v(cat, slug, name, ord)
JOIN public.recruiting_categories c ON c.slug = v.cat
ON CONFLICT (category_id, slug) DO NOTHING;

INSERT INTO public.recruiting_campaigns (code, name, platform, business_slug, notes)
VALUES ('PBX-SOURCING','Playboxxx Sourcing','instagram','playboxxx',
        'Default attribution for Playboxxx creator/model sourcing ingest. No outreach.')
ON CONFLICT (code) DO NOTHING;

-- 4. Playboxxx business lead queue: shared canonical rows eligible for playboxxx
--    plus the pre-existing playboxxx-partition rows. Suppressed numbers excluded.
CREATE OR REPLACE VIEW public.v_playboxxx_business_leads
WITH (security_invoker = on) AS
SELECT l.id, l.business_name, l.contact_name, l.category, l.category_original,
       l.phone, l.email, l.website, l.full_address, l.street_address, l.city, l.state, l.zip, l.country,
       l.latitude, l.longitude, l.source, l.external_source, l.external_place_id, l.source_record_id,
       l.source_url, l.search_term, l.instagram_username, l.instagram_url, l.instagram_followers,
       l.ingestion_run_id, l.times_seen, l.status, l.created_at, l.updated_at,
       'shared'::text AS record_lane,
       e.reason AS eligibility_reason, e.rule AS eligibility_rule
  FROM business_leads l
  JOIN business_lead_eligibility e
    ON e.lead_id = l.id AND e.company = 'playboxxx' AND e.eligible
 WHERE l.duplicate_of IS NULL
   AND NOT EXISTS (SELECT 1 FROM dnc_list d WHERE d.phone_last10 = l.phone_last10)
   AND NOT EXISTS (SELECT 1 FROM opt_out_events o WHERE o.phone_last10 = l.phone_last10)
UNION ALL
SELECT l.id, l.business_name, l.contact_name, l.category, l.category_original,
       l.phone, l.email, l.website, l.full_address, l.street_address, l.city, l.state, l.zip, l.country,
       l.latitude, l.longitude, l.source, l.external_source, l.external_place_id, l.source_record_id,
       l.source_url, l.search_term, l.instagram_username, l.instagram_url, l.instagram_followers,
       l.ingestion_run_id, l.times_seen, l.status, l.created_at, l.updated_at,
       'legacy_playboxxx'::text AS record_lane,
       NULL::text, NULL::text
  FROM business_leads l
 WHERE l.business = 'playboxxx'
   AND l.duplicate_of IS NULL
   AND NOT EXISTS (SELECT 1 FROM dnc_list d WHERE d.phone_last10 = l.phone_last10)
   AND NOT EXISTS (SELECT 1 FROM opt_out_events o WHERE o.phone_last10 = l.phone_last10);

REVOKE ALL ON public.v_playboxxx_business_leads FROM anon;
GRANT SELECT ON public.v_playboxxx_business_leads TO authenticated;

INSERT INTO public.public_view_contracts (view_name, public_roles, allowed_privileges, forbidden_columns, notes)
VALUES ('v_playboxxx_business_leads', ARRAY['authenticated'], ARRAY['SELECT'], ARRAY['assigned_to','notes'],
        'Playboxxx business queue over business_leads: shared canonical rows with playboxxx eligibility plus the legacy playboxxx partition. Suppressed numbers (dnc_list + opt_out_events, last-10) excluded by the view. No anon.')
ON CONFLICT (view_name) DO NOTHING;