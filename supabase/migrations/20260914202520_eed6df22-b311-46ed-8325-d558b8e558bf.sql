CREATE OR REPLACE FUNCTION public.icw_promote_to_worker(_source text, _record_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text; v_email text; v_phone text; v_state text;
  v_cats text[]; v_lic text; v_avail text; v_notes text;
  v_existing uuid; v_worker uuid; v_action text;
  v_last10 text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role)) THEN
    RAISE EXCEPTION 'not authorized to promote ICW records';
  END IF;

  IF _source = 'lead' THEN
    SELECT full_name, email, phone, coalesce(region, state), coalesce(category_groups, '{}'),
           coalesce(license_status, 'unknown'), NULL, notes, promoted_worker_id
      INTO v_name, v_email, v_phone, v_state, v_cats, v_lic, v_avail, v_notes, v_existing
      FROM public.icw_sourced_leads WHERE id = _record_id;
  ELSIF _source = 'candidate' THEN
    SELECT full_name, email, phone, coalesce(region, state), coalesce(category_groups, '{}'),
           'unknown', availability_summary, notes, converted_worker_id
      INTO v_name, v_email, v_phone, v_state, v_cats, v_lic, v_avail, v_notes, v_existing
      FROM public.icw_candidate_leads WHERE id = _record_id;
  ELSE
    RAISE EXCEPTION 'unknown source %', _source;
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'ICW % record % not found or has no name', _source, _record_id;
  END IF;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('worker_id', v_existing, 'action', 'already_promoted');
  END IF;

  v_last10 := right(regexp_replace(coalesce(v_phone, ''), '\D', '', 'g'), 10);

  SELECT id INTO v_worker FROM public.icw_workers
   WHERE (length(v_last10) = 10 AND right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = v_last10)
      OR (v_email IS NOT NULL AND v_email <> '' AND lower(email) = lower(v_email))
   ORDER BY created_at LIMIT 1;

  IF v_worker IS NOT NULL THEN
    v_action := 'linked_existing_worker';
    UPDATE public.icw_workers
       SET category_groups = (SELECT array_agg(DISTINCT c) FROM unnest(category_groups || v_cats) c),
           state = coalesce(state, v_state),
           phone = coalesce(phone, v_phone),
           email = coalesce(email, v_email),
           availability = coalesce(availability, v_avail),
           updated_at = now()
     WHERE id = v_worker;
  ELSE
    INSERT INTO public.icw_workers (full_name, email, phone, state, category_groups, license_status, availability, approved, notes)
    VALUES (v_name, v_email, v_phone, v_state, v_cats, coalesce(v_lic, 'unknown'), v_avail, false, v_notes)
    RETURNING id INTO v_worker;
    v_action := 'worker_created';
  END IF;

  IF _source = 'lead' THEN
    UPDATE public.icw_sourced_leads
       SET promoted_worker_id = v_worker, status = 'promoted', updated_at = now()
     WHERE id = _record_id;
  ELSE
    UPDATE public.icw_candidate_leads
       SET converted_worker_id = v_worker, status = 'converted', updated_at = now()
     WHERE id = _record_id;
  END IF;

  RETURN jsonb_build_object('worker_id', v_worker, 'action', v_action);
END;
$$;

REVOKE ALL ON FUNCTION public.icw_promote_to_worker(text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.icw_promote_to_worker(text, uuid) TO authenticated, service_role;