-- Map raw source categories onto the canonical vocabulary; keep the raw value as provenance
CREATE OR REPLACE FUNCTION public.bl_canonical_category(_raw text)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  IF coalesce(_raw,'') = '' THEN RETURN 'other'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c,
      regexp_matches(pg_get_constraintdef(c.oid), '''([a-z_]+)''::text', 'g') m
    WHERE c.conname = 'business_leads_category_canonical' AND m[1] = lower(_raw)
  ) INTO ok;
  RETURN CASE WHEN ok THEN lower(_raw) ELSE 'other' END;
END $$;

CREATE OR REPLACE FUNCTION public.ingest_business_lead(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text := nullif(btrim(p->>'business_name'),'');
  v_phone text := nullif(btrim(p->>'phone'),'');
  v_last10 text;
  v_domain text := bl_domain(p->>'website');
  v_name_norm text := bl_norm_name(v_name);
  v_addr_norm text := bl_norm_addr(coalesce(p->>'street_address', p->>'full_address'));
  v_src text := coalesce(nullif(p->>'source',''),'manual');
  v_src_id text := nullif(coalesce(p->>'source_record_id', p->>'external_place_id'),'');
  v_raw_cat text := nullif(p->>'category','');
  v_cat text := bl_canonical_category(p->>'category');
  v_id uuid; v_action text; v_matched text; c text;
BEGIN
  IF v_name IS NULL THEN RAISE EXCEPTION 'ingest_business_lead: business_name required'; END IF;

  v_last10 := CASE WHEN length(regexp_replace(coalesce(v_phone,''),'[^0-9]','','g')) >= 10
                   THEN right(regexp_replace(v_phone,'[^0-9]','','g'),10) END;

  IF v_src_id IS NOT NULL THEN
    SELECT id INTO v_id FROM business_leads
     WHERE business='shared' AND duplicate_of IS NULL
       AND external_source = coalesce(nullif(p->>'external_source',''), v_src)
       AND source_record_id = v_src_id LIMIT 1;
    IF v_id IS NOT NULL THEN v_matched := 'source_record_id'; END IF;
  END IF;
  IF v_id IS NULL AND v_last10 IS NOT NULL THEN
    SELECT id INTO v_id FROM business_leads
     WHERE business='shared' AND duplicate_of IS NULL AND phone_last10 = v_last10 LIMIT 1;
    IF v_id IS NOT NULL THEN v_matched := 'phone'; END IF;
  END IF;
  IF v_id IS NULL AND v_domain IS NOT NULL THEN
    SELECT id INTO v_id FROM business_leads
     WHERE business='shared' AND duplicate_of IS NULL AND website_domain = v_domain LIMIT 1;
    IF v_id IS NOT NULL THEN v_matched := 'website_domain'; END IF;
  END IF;
  IF v_id IS NULL AND v_name_norm IS NOT NULL AND v_addr_norm IS NOT NULL THEN
    SELECT id INTO v_id FROM business_leads
     WHERE business='shared' AND duplicate_of IS NULL
       AND name_norm = v_name_norm AND addr_norm = v_addr_norm LIMIT 1;
    IF v_id IS NOT NULL THEN v_matched := 'name_address'; END IF;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO business_leads (
      business, business_name, category, category_original, phone, email, website,
      street_address, full_address, city, state, zip, country,
      latitude, longitude, source, external_source, external_place_id,
      source_record_id, source_url, metro, google_types, maps_url,
      ingestion_run_id, status, ai_call_eligible
    ) VALUES (
      'shared', v_name, v_cat, v_raw_cat, v_phone,
      nullif(p->>'email',''), nullif(p->>'website',''),
      nullif(p->>'street_address',''), nullif(p->>'full_address',''),
      nullif(p->>'city',''), nullif(upper(left(p->>'state',2)),''),
      nullif(p->>'zip',''), coalesce(nullif(p->>'country',''),'US'),
      (p->>'latitude')::numeric, (p->>'longitude')::numeric,
      v_src, coalesce(nullif(p->>'external_source',''), v_src),
      nullif(p->>'external_place_id',''), v_src_id, nullif(p->>'source_url',''),
      nullif(p->>'metro',''),
      CASE WHEN p ? 'google_types' THEN ARRAY(SELECT jsonb_array_elements_text(p->'google_types')) END,
      nullif(p->>'maps_url',''),
      nullif(p->>'ingestion_run_id','')::uuid, 'new', v_phone IS NOT NULL
    ) RETURNING id INTO v_id;
    v_action := 'inserted';
  ELSE
    UPDATE business_leads SET
      phone            = coalesce(phone, v_phone),
      email            = coalesce(email, nullif(p->>'email','')),
      website          = coalesce(website, nullif(p->>'website','')),
      category_original= coalesce(category_original, v_raw_cat),
      street_address   = coalesce(street_address, nullif(p->>'street_address','')),
      full_address     = coalesce(full_address, nullif(p->>'full_address','')),
      city             = coalesce(city, nullif(p->>'city','')),
      state            = coalesce(state, nullif(upper(left(p->>'state',2)),'')),
      zip              = coalesce(zip, nullif(p->>'zip','')),
      country          = coalesce(country, nullif(p->>'country',''),'US'),
      latitude         = coalesce(latitude, (p->>'latitude')::numeric),
      longitude        = coalesce(longitude, (p->>'longitude')::numeric),
      source_url       = coalesce(source_url, nullif(p->>'source_url','')),
      source_record_id = coalesce(source_record_id, v_src_id),
      external_place_id= coalesce(external_place_id, nullif(p->>'external_place_id','')),
      metro            = coalesce(metro, nullif(p->>'metro','')),
      maps_url         = coalesce(maps_url, nullif(p->>'maps_url','')),
      ingestion_run_id = coalesce(nullif(p->>'ingestion_run_id','')::uuid, ingestion_run_id),
      ai_call_eligible = coalesce(phone, v_phone) IS NOT NULL,
      times_seen       = coalesce(times_seen,0) + 1,
      updated_at       = now()
    WHERE id = v_id;
    v_action := 'deduped';
  END IF;

  IF p ? 'companies' THEN
    FOR c IN SELECT jsonb_array_elements_text(p->'companies') LOOP
      INSERT INTO business_lead_eligibility (lead_id, company, eligible, reason, rule)
      VALUES (v_id, c, true, coalesce(nullif(p->>'eligibility_reason',''),'explicit'), 'explicit')
      ON CONFLICT (lead_id, company) DO UPDATE SET eligible = true, updated_at = now();
    END LOOP;
  END IF;

  PERFORM apply_business_lead_eligibility(v_id);

  RETURN jsonb_build_object('lead_id', v_id, 'action', v_action, 'matched_on', v_matched);
END $$;
REVOKE ALL ON FUNCTION public.ingest_business_lead(jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_business_lead(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.bl_canonical_category(text) FROM public, anon;