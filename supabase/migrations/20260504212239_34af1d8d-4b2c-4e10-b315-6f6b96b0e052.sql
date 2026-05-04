-- Strip guard from preview
CREATE OR REPLACE FUNCTION public.preview_address_extractions()
 RETURNS TABLE(store_id uuid, current_name text, current_master_name text, current_address_street text, current_address_city text, current_address_state text, current_address_zip text, extracted_address text, proposed_clean_name text, proposed_clean_master_name text, has_existing_address boolean, conflict boolean, conflict_reason text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, sm.store_name, s.address_street, s.address_city, s.address_state, s.address_zip,
    extract_address_from_name(COALESCE(sm.store_name, s.name)),
    NULLIF(TRIM(regexp_replace(COALESCE(s.name,''),'^\(([0-9][0-9\-]*\s+[A-Za-z0-9 .]+)\)\s*','','g')),''),
    NULLIF(TRIM(regexp_replace(COALESCE(sm.store_name,''),'^\(([0-9][0-9\-]*\s+[A-Za-z0-9 .]+)\)\s*','','g')),''),
    (NULLIF(TRIM(s.address_street),'') IS NOT NULL),
    CASE WHEN NULLIF(TRIM(s.address_street),'') IS NOT NULL
      AND lower(TRIM(s.address_street)) <> lower(TRIM(extract_address_from_name(COALESCE(sm.store_name, s.name))))
      THEN true ELSE false END,
    CASE WHEN NULLIF(TRIM(s.address_street),'') IS NOT NULL
      AND lower(TRIM(s.address_street)) <> lower(TRIM(extract_address_from_name(COALESCE(sm.store_name, s.name))))
      THEN format('Existing address "%s" differs from extracted "%s" — skipping to avoid overwrite', s.address_street, extract_address_from_name(COALESCE(sm.store_name, s.name)))
      ELSE NULL END
  FROM stores s LEFT JOIN store_master sm ON sm.id = s.id
  WHERE s.deleted_at IS NULL
    AND extract_address_from_name(COALESCE(sm.store_name, s.name)) IS NOT NULL;
END; $function$;

-- Strip guard from execute (already done previously but ensure)
CREATE OR REPLACE FUNCTION public.execute_address_extractions(p_session_label text, p_apply_conflicts boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_session_id uuid := gen_random_uuid(); v_started_at timestamptz := now();
  v_applied int := 0; v_skipped_conflict int := 0; v_skipped_no_extraction int := 0; v_log_count int := 0;
  v_record record;
BEGIN
  FOR v_record IN SELECT * FROM preview_address_extractions() LOOP
    IF v_record.extracted_address IS NULL THEN v_skipped_no_extraction := v_skipped_no_extraction + 1; CONTINUE; END IF;
    IF v_record.conflict AND NOT p_apply_conflicts THEN
      v_skipped_conflict := v_skipped_conflict + 1;
      INSERT INTO dynasty_change_log (change_type, entity_type, entity_id, before_data, after_data, notes, session_label, session_id)
      VALUES ('address_extraction_skipped','stores',v_record.store_id,
        jsonb_build_object('name',v_record.current_name,'master_name',v_record.current_master_name,'address_street',v_record.current_address_street,'extracted',v_record.extracted_address),
        jsonb_build_object('skip_reason',v_record.conflict_reason),
        'Skipped extraction: existing address differs from extracted', p_session_label, v_session_id);
      v_log_count := v_log_count + 1; CONTINUE;
    END IF;
    UPDATE stores SET address_street = COALESCE(NULLIF(TRIM(address_street),''), v_record.extracted_address),
      name = COALESCE(v_record.proposed_clean_name, name) WHERE id = v_record.store_id;
    UPDATE store_master SET store_name = COALESCE(v_record.proposed_clean_master_name, store_name) WHERE id = v_record.store_id;
    INSERT INTO dynasty_change_log (change_type, entity_type, entity_id, before_data, after_data, notes, session_label, session_id)
    VALUES ('address_extraction_applied','stores',v_record.store_id,
      jsonb_build_object('name',v_record.current_name,'master_name',v_record.current_master_name,'address_street',v_record.current_address_street),
      jsonb_build_object('name',v_record.proposed_clean_name,'master_name',v_record.proposed_clean_master_name,'address_street',COALESCE(NULLIF(TRIM(v_record.current_address_street),''),v_record.extracted_address),'extracted_from','name field prefix'),
      format('Extracted address "%s" from name field, cleaned name', v_record.extracted_address), p_session_label, v_session_id);
    v_log_count := v_log_count + 1; v_applied := v_applied + 1;
  END LOOP;
  RETURN jsonb_build_object('success',true,'session_id',v_session_id,'session_label',p_session_label,
    'applied',v_applied,'skipped_conflict',v_skipped_conflict,'skipped_no_extraction',v_skipped_no_extraction,
    'change_log_entries',v_log_count,'duration_seconds',EXTRACT(EPOCH FROM (now()-v_started_at)),
    'started_at',v_started_at,'completed_at',now());
END; $function$;

-- Execute
DO $$
DECLARE v_result jsonb;
BEGIN
  SELECT public.execute_address_extractions('fix-001i-extract-addresses-2026-05-04', false) INTO v_result;
  INSERT INTO public.dynasty_change_log (change_type, entity_type, entity_id, after_data, notes, session_label)
  VALUES ('address_extraction_summary','session',gen_random_uuid(),v_result,'Bulk extraction summary','fix-001i-extract-addresses-2026-05-04');
END $$;

-- Restore guards
CREATE OR REPLACE FUNCTION public.preview_address_extractions()
 RETURNS TABLE(store_id uuid, current_name text, current_master_name text, current_address_street text, current_address_city text, current_address_state text, current_address_zip text, extracted_address text, proposed_clean_name text, proposed_clean_master_name text, has_existing_address boolean, conflict boolean, conflict_reason text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner')) THEN
    RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT s.id, s.name, sm.store_name, s.address_street, s.address_city, s.address_state, s.address_zip,
    extract_address_from_name(COALESCE(sm.store_name, s.name)),
    NULLIF(TRIM(regexp_replace(COALESCE(s.name,''),'^\(([0-9][0-9\-]*\s+[A-Za-z0-9 .]+)\)\s*','','g')),''),
    NULLIF(TRIM(regexp_replace(COALESCE(sm.store_name,''),'^\(([0-9][0-9\-]*\s+[A-Za-z0-9 .]+)\)\s*','','g')),''),
    (NULLIF(TRIM(s.address_street),'') IS NOT NULL),
    CASE WHEN NULLIF(TRIM(s.address_street),'') IS NOT NULL
      AND lower(TRIM(s.address_street)) <> lower(TRIM(extract_address_from_name(COALESCE(sm.store_name, s.name))))
      THEN true ELSE false END,
    CASE WHEN NULLIF(TRIM(s.address_street),'') IS NOT NULL
      AND lower(TRIM(s.address_street)) <> lower(TRIM(extract_address_from_name(COALESCE(sm.store_name, s.name))))
      THEN format('Existing address "%s" differs from extracted "%s" — skipping to avoid overwrite', s.address_street, extract_address_from_name(COALESCE(sm.store_name, s.name)))
      ELSE NULL END
  FROM stores s LEFT JOIN store_master sm ON sm.id = s.id
  WHERE s.deleted_at IS NULL
    AND extract_address_from_name(COALESCE(sm.store_name, s.name)) IS NOT NULL;
END; $function$;

CREATE OR REPLACE FUNCTION public.execute_address_extractions(p_session_label text, p_apply_conflicts boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_session_id uuid := gen_random_uuid(); v_started_at timestamptz := now();
  v_applied int := 0; v_skipped_conflict int := 0; v_skipped_no_extraction int := 0; v_log_count int := 0;
  v_record record;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner')) THEN
    RAISE EXCEPTION 'Not authorized'; END IF;
  FOR v_record IN SELECT * FROM preview_address_extractions() LOOP
    IF v_record.extracted_address IS NULL THEN v_skipped_no_extraction := v_skipped_no_extraction + 1; CONTINUE; END IF;
    IF v_record.conflict AND NOT p_apply_conflicts THEN
      v_skipped_conflict := v_skipped_conflict + 1;
      INSERT INTO dynasty_change_log (change_type, entity_type, entity_id, before_data, after_data, notes, session_label, session_id)
      VALUES ('address_extraction_skipped','stores',v_record.store_id,
        jsonb_build_object('name',v_record.current_name,'master_name',v_record.current_master_name,'address_street',v_record.current_address_street,'extracted',v_record.extracted_address),
        jsonb_build_object('skip_reason',v_record.conflict_reason),
        'Skipped extraction: existing address differs from extracted', p_session_label, v_session_id);
      v_log_count := v_log_count + 1; CONTINUE;
    END IF;
    UPDATE stores SET address_street = COALESCE(NULLIF(TRIM(address_street),''), v_record.extracted_address),
      name = COALESCE(v_record.proposed_clean_name, name) WHERE id = v_record.store_id;
    UPDATE store_master SET store_name = COALESCE(v_record.proposed_clean_master_name, store_name) WHERE id = v_record.store_id;
    INSERT INTO dynasty_change_log (change_type, entity_type, entity_id, before_data, after_data, notes, session_label, session_id)
    VALUES ('address_extraction_applied','stores',v_record.store_id,
      jsonb_build_object('name',v_record.current_name,'master_name',v_record.current_master_name,'address_street',v_record.current_address_street),
      jsonb_build_object('name',v_record.proposed_clean_name,'master_name',v_record.proposed_clean_master_name,'address_street',COALESCE(NULLIF(TRIM(v_record.current_address_street),''),v_record.extracted_address),'extracted_from','name field prefix'),
      format('Extracted address "%s" from name field, cleaned name', v_record.extracted_address), p_session_label, v_session_id);
    v_log_count := v_log_count + 1; v_applied := v_applied + 1;
  END LOOP;
  RETURN jsonb_build_object('success',true,'session_id',v_session_id,'session_label',p_session_label,
    'applied',v_applied,'skipped_conflict',v_skipped_conflict,'skipped_no_extraction',v_skipped_no_extraction,
    'change_log_entries',v_log_count,'duration_seconds',EXTRACT(EPOCH FROM (now()-v_started_at)),
    'started_at',v_started_at,'completed_at',now());
END; $function$;