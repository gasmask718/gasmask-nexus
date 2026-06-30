CREATE OR REPLACE FUNCTION public.tt_promote_crm_partner_to_tt_partner(
  p_crm_partner_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crm                  public.crm_partners%ROWTYPE;
  v_partner_type         text;
  v_service_category     text;
  v_existing_tt_id       uuid;
  v_new_tt_id            uuid;
  v_excluded_categories  text[] := ARRAY['luxury_residences','amusementparks_affiliate'];
  v_now                  timestamptz := now();
  v_notes_concat         text;
BEGIN
  SELECT * INTO v_crm FROM public.crm_partners WHERE id = p_crm_partner_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'crm_partners row % not found', p_crm_partner_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_crm.business_slug IS DISTINCT FROM 'toptier-experience' THEN
    RAISE EXCEPTION 'crm_partners row % is not a TopTier prospect (business_slug=%)',
      p_crm_partner_id, v_crm.business_slug
      USING ERRCODE = 'P0001';
  END IF;

  IF v_crm.tt_acquisition_stage = 'activated' THEN
    SELECT id INTO v_existing_tt_id
      FROM public.tt_partners
     WHERE application_id_external = p_crm_partner_id
     LIMIT 1;
    RETURN jsonb_build_object(
      'promoted', false,
      'reason', 'already_activated',
      'tt_partner_id', v_existing_tt_id,
      'stage', 'activated'
    );
  END IF;

  IF v_crm.partner_category = ANY (v_excluded_categories) THEN
    UPDATE public.crm_partners
       SET tt_acquisition_stage = 'manual_onboarding_required',
           tt_acquisition_notes = COALESCE(tt_acquisition_notes || E'\n', '')
             || format('[%s] manual_onboarding_required: category %s excluded from auto-promotion per policy',
                       to_char(v_now, 'YYYY-MM-DD'), v_crm.partner_category),
           updated_at = v_now
     WHERE id = p_crm_partner_id;

    RETURN jsonb_build_object(
      'promoted', false,
      'reason', 'manual_onboarding_required',
      'stage', 'manual_onboarding_required',
      'partner_category', v_crm.partner_category
    );
  END IF;

  CASE v_crm.partner_category
    WHEN 'black_trucks_promo'      THEN v_partner_type := 'chauffeur';           v_service_category := 'transport';
    WHEN 'drivers'                 THEN v_partner_type := 'chauffeur';           v_service_category := 'transport';
    WHEN 'exotic_rental_car_promo' THEN v_partner_type := 'exotic_supplier';     v_service_category := 'transport';
    WHEN 'helicopter_promo'        THEN v_partner_type := 'helicopter_operator'; v_service_category := 'aviation';
    WHEN 'party_bus_promo'         THEN v_partner_type := 'party_bus_operator';  v_service_category := 'transport';
    WHEN 'sprinter_van_promo'      THEN v_partner_type := 'sprinter_operator';   v_service_category := 'transport';
    WHEN 'yachts'                  THEN v_partner_type := 'watercraft_operator'; v_service_category := 'watercraft';
    WHEN 'car_jetskis'             THEN v_partner_type := 'watercraft_operator'; v_service_category := 'watercraft';
    ELSE
      RAISE EXCEPTION 'Unmapped partner_category % for crm_partners row %',
        v_crm.partner_category, p_crm_partner_id
        USING ERRCODE = 'P0001';
  END CASE;

  v_notes_concat :=
    COALESCE(NULLIF(v_crm.notes, ''), '') ||
    CASE WHEN v_crm.tt_acquisition_notes IS NOT NULL
         THEN E'\n--- acquisition notes ---\n' || v_crm.tt_acquisition_notes
         ELSE '' END ||
    format(E'\n--- promotion ---\n[%s] Promoted from crm_partners via tt-acquisition pipeline. Original partner_category: %s',
           to_char(v_now, 'YYYY-MM-DD'), v_crm.partner_category);

  INSERT INTO public.tt_partners (
    name,
    business_name,
    phone,
    email,
    city,
    state,
    partner_type,
    service_category,
    status,
    portal_status,
    trust_score,
    commission_rate,
    is_active,
    application_id_external,
    notes,
    metadata
  ) VALUES (
    COALESCE(NULLIF(v_crm.company_name, ''), v_crm.contact_name, 'Unnamed Partner'),
    v_crm.company_name,
    v_crm.phone,
    v_crm.email,
    v_crm.city,
    v_crm.state,
    v_partner_type,
    v_service_category,
    'pending',
    'seeded',
    3,
    15,
    true,
    p_crm_partner_id,
    NULLIF(v_notes_concat, ''),
    jsonb_build_object(
      'promoted_from', 'crm_partners',
      'original_partner_category', v_crm.partner_category,
      'promoted_at', v_now,
      'source_business_slug', 'toptier-experience'
    )
  )
  RETURNING id INTO v_new_tt_id;

  UPDATE public.crm_partners
     SET tt_acquisition_stage = 'activated',
         tt_acquisition_notes = COALESCE(tt_acquisition_notes || E'\n', '')
           || format('[%s] activated: tt_partners row %s (partner_type=%s)',
                     to_char(v_now, 'YYYY-MM-DD'), v_new_tt_id, v_partner_type),
         updated_at = v_now
   WHERE id = p_crm_partner_id;

  RETURN jsonb_build_object(
    'promoted', true,
    'tt_partner_id', v_new_tt_id,
    'partner_type', v_partner_type,
    'service_category', v_service_category,
    'stage', 'activated'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.tt_promote_crm_partner_to_tt_partner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tt_promote_crm_partner_to_tt_partner(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.tt_promote_crm_partner_to_tt_partner(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.tt_promote_crm_partner_to_tt_partner(uuid) TO service_role;