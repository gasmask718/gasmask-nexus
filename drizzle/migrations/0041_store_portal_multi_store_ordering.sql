ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS batch_id uuid;
CREATE INDEX IF NOT EXISTS delivery_requests_batch_id_idx ON public.delivery_requests(batch_id) WHERE batch_id IS NOT NULL;

ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS portal_owner_request_status text,
  ADD COLUMN IF NOT EXISTS portal_owner_requested_by uuid,
  ADD COLUMN IF NOT EXISTS portal_owner_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_owner_target_group uuid,
  ADD COLUMN IF NOT EXISTS portal_owner_prospect_key text,
  ADD COLUMN IF NOT EXISTS portal_owner_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS portal_owner_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_owner_review_note text;
ALTER TABLE public.store_master DROP CONSTRAINT IF EXISTS store_master_portal_owner_request_status_check;
ALTER TABLE public.store_master ADD CONSTRAINT store_master_portal_owner_request_status_check
  CHECK (portal_owner_request_status IS NULL OR portal_owner_request_status IN ('pending','approved','rejected'));
CREATE INDEX IF NOT EXISTS store_master_portal_owner_pending_idx ON public.store_master(portal_owner_requested_at) WHERE portal_owner_request_status = 'pending';

-- Orderable = not an unapproved owner-added store.
CREATE OR REPLACE FUNCTION public.store_portal_store_orderable(p_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.store_master sm WHERE sm.id = p_store_id AND sm.deleted_at IS NULL
    AND NOT (COALESCE(sm.source,'') = 'store_portal_owner_added' AND COALESCE(sm.portal_owner_request_status,'pending') <> 'approved'))
$$;

CREATE OR REPLACE FUNCTION public.store_portal_request_delivery(
  p_store_id uuid, p_request_type text, p_requested_date date, p_time_window text,
  p_items jsonb, p_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_item jsonb; v_batch uuid := nullif(current_setting('app.portal_batch_id', true), '')::uuid;
BEGIN
  PERFORM public._assert_store_portal_access(p_store_id);
  IF NOT public.store_portal_store_orderable(p_store_id) THEN
    RAISE EXCEPTION 'This store is waiting for approval and cannot receive orders yet';
  END IF;
  IF p_request_type NOT IN ('asap','scheduled') THEN RAISE EXCEPTION 'invalid request type'; END IF;
  IF p_request_type = 'scheduled' THEN
    IF p_requested_date IS NULL OR p_requested_date < CURRENT_DATE OR p_requested_date > CURRENT_DATE + 30 THEN
      RAISE EXCEPTION 'scheduled date must be within the next 30 days';
    END IF;
    IF p_time_window IS NULL OR p_time_window NOT IN ('morning','afternoon','evening') THEN
      RAISE EXCEPTION 'invalid time window';
    END IF;
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 20 THEN
    RAISE EXCEPTION 'items must be a non-empty array';
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF COALESCE(v_item->>'name','') = '' OR COALESCE((v_item->>'quantity')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'each item needs a name and a quantity';
    END IF;
  END LOOP;
  INSERT INTO public.delivery_requests
    (store_id, requested_by, request_type, requested_date, time_window, items, notes, status, batch_id)
  VALUES (p_store_id, auth.uid(), p_request_type,
          CASE WHEN p_request_type = 'scheduled' THEN p_requested_date END,
          CASE WHEN p_request_type = 'scheduled' THEN p_time_window END,
          p_items, left(COALESCE(p_notes,''), 1000), 'new', v_batch)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.store_portal_stores()
RETURNS TABLE(store_id uuid, store_name text, address text, city text, state text, zip text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT sm.id, sm.store_name, sm.address, sm.city, sm.state, sm.zip
  FROM public.store_master sm
  WHERE auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'store'::public.app_role)
    AND public.is_store_user_for(auth.uid(), sm.id)
    AND sm.deleted_at IS NULL
    AND COALESCE(sm.is_simulation, false) IS FALSE
    AND public.store_portal_store_orderable(sm.id)
  ORDER BY sm.store_name
$$;

-- Every store this owner has (linked) plus their pending/rejected add requests.
CREATE OR REPLACE FUNCTION public.store_portal_owner_stores()
RETURNS TABLE(store_id uuid, store_name text, address text, city text, state text, zip text,
              approval text, orderable boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT sm.id, sm.store_name, sm.address, sm.city, sm.state, sm.zip,
    CASE
      WHEN public.store_portal_store_orderable(sm.id) AND public.is_store_user_for(auth.uid(), sm.id) THEN 'linked'
      ELSE COALESCE(sm.portal_owner_request_status, 'pending') END,
    public.store_portal_store_orderable(sm.id) AND public.is_store_user_for(auth.uid(), sm.id)
  FROM public.store_master sm
  WHERE auth.uid() IS NOT NULL
    AND public.has_role(auth.uid(), 'store'::public.app_role)
    AND sm.deleted_at IS NULL AND COALESCE(sm.is_simulation, false) IS FALSE
    AND (public.is_store_user_for(auth.uid(), sm.id) OR sm.portal_owner_requested_by = auth.uid())
  ORDER BY 8 DESC, sm.store_name
$$;
GRANT EXECUTE ON FUNCTION public.store_portal_owner_stores() TO authenticated;

-- Send one request per store, all sharing one batch id; atomic.
CREATE OR REPLACE FUNCTION public.store_portal_send_order_batch(p_orders jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_batch uuid := gen_random_uuid(); v_o jsonb; v_id uuid; v_out jsonb := '[]'::jsonb; v_seen uuid[] := '{}'; v_sid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF jsonb_typeof(p_orders) <> 'array' OR jsonb_array_length(p_orders) = 0 OR jsonb_array_length(p_orders) > 40 THEN
    RAISE EXCEPTION 'pick between 1 and 40 stores';
  END IF;
  PERFORM set_config('app.portal_batch_id', v_batch::text, true);
  FOR v_o IN SELECT * FROM jsonb_array_elements(p_orders) LOOP
    v_sid := (v_o->>'store_id')::uuid;
    IF v_sid = ANY(v_seen) THEN RAISE EXCEPTION 'store listed twice'; END IF;
    v_seen := v_seen || v_sid;
    v_id := public.store_portal_request_delivery(v_sid, COALESCE(v_o->>'request_type','asap'),
      nullif(v_o->>'requested_date','')::date, nullif(v_o->>'time_window',''), v_o->'items', v_o->>'notes');
    v_out := v_out || jsonb_build_object('store_id', v_sid, 'request_id', v_id);
  END LOOP;
  PERFORM set_config('app.portal_batch_id', '', true);
  RETURN jsonb_build_object('batch_id', v_batch, 'requests', v_out);
END $$;
GRANT EXECUTE ON FUNCTION public.store_portal_send_order_batch(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.store_portal_owner_requests()
RETURNS TABLE(id uuid, store_id uuid, store_name text, address text, request_type text, requested_date date,
  time_window text, items jsonb, notes text, status text, created_at timestamptz, batch_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT dr.id, dr.store_id, sm.store_name, concat_ws(', ', sm.address, sm.city, sm.state), dr.request_type, dr.requested_date,
    dr.time_window, dr.items, dr.notes, dr.status, dr.created_at, dr.batch_id
  FROM public.delivery_requests dr JOIN public.store_master sm ON sm.id = dr.store_id
  WHERE auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'store'::public.app_role)
    AND public.is_store_user_for(auth.uid(), dr.store_id)
  ORDER BY dr.created_at DESC
  LIMIT 500
$$;
GRANT EXECUTE ON FUNCTION public.store_portal_owner_requests() TO authenticated;

CREATE OR REPLACE FUNCTION public._portal_norm_addr(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(regexp_replace(lower(btrim(COALESCE(t,''))), '\s+', ' ', 'g'), '')
$$;

-- Owner adds another store they own. Exact address match links existing record (pending approval).
CREATE OR REPLACE FUNCTION public.store_portal_add_owner_store(
  p_anchor_store_id uuid, p_address text, p_city text, p_state text, p_zip text,
  p_store_name text DEFAULT NULL, p_phone text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_anchor public.store_master%ROWTYPE; v_group uuid; v_match public.store_master%ROWTYPE;
        v_pros public.store_prospects%ROWTYPE; v_new uuid; v_addr text := public._portal_norm_addr(p_address);
        v_zip text := nullif(btrim(COALESCE(p_zip,'')), ''); v_city text := public._portal_norm_addr(p_city);
BEGIN
  PERFORM public._assert_store_portal_access(p_anchor_store_id);
  IF v_addr IS NULL OR length(v_addr) < 5 THEN RAISE EXCEPTION 'Please type the street address'; END IF;
  IF v_zip IS NULL AND v_city IS NULL THEN RAISE EXCEPTION 'Please add the ZIP code or city'; END IF;
  SELECT * INTO v_anchor FROM public.store_master WHERE id = p_anchor_store_id;
  v_group := v_anchor.connected_group_id;
  IF v_group IS NULL THEN
    v_group := gen_random_uuid();
    UPDATE public.store_master SET connected_group_id = v_group WHERE id = p_anchor_store_id;
  END IF;

  SELECT * INTO v_match FROM public.store_master sm
   WHERE sm.deleted_at IS NULL AND public._portal_norm_addr(sm.address) = v_addr
     AND ((v_zip IS NOT NULL AND btrim(COALESCE(sm.zip,'')) = v_zip) OR (v_zip IS NULL AND public._portal_norm_addr(sm.city) = v_city))
   ORDER BY sm.created_at LIMIT 1;
  IF FOUND THEN
    IF public.is_store_user_for(auth.uid(), v_match.id) AND public.store_portal_store_orderable(v_match.id) THEN
      RETURN jsonb_build_object('result','already_linked','store_id',v_match.id,'store_name',v_match.store_name);
    END IF;
    IF v_match.portal_owner_requested_by IS NOT NULL AND v_match.portal_owner_request_status = 'pending' THEN
      RETURN jsonb_build_object('result','already_pending','store_id',v_match.id,'store_name',v_match.store_name);
    END IF;
    UPDATE public.store_master SET portal_owner_request_status = 'pending', portal_owner_requested_by = auth.uid(),
      portal_owner_requested_at = now(), portal_owner_target_group = v_group,
      portal_owner_reviewed_by = NULL, portal_owner_reviewed_at = NULL
     WHERE id = v_match.id;
    INSERT INTO public.store_notes (store_id, note_text, created_by, note_date, source)
    VALUES (v_match.id, 'Store portal: owner of ' || COALESCE(v_anchor.store_name,'a linked store') || ' says they also own this store. Waiting for Ching to approve linking.', auth.uid(), CURRENT_DATE, 'store_portal');
    RETURN jsonb_build_object('result','linked_existing','store_id',v_match.id,'store_name',v_match.store_name);
  END IF;

  SELECT * INTO v_pros FROM public.store_prospects sp
   WHERE public._portal_norm_addr(sp.address) = v_addr
     AND ((v_zip IS NOT NULL AND btrim(COALESCE(sp.zip,'')) = v_zip) OR (v_zip IS NULL AND public._portal_norm_addr(sp.city) = v_city))
   LIMIT 1;

  INSERT INTO public.store_master (store_name, address, city, state, zip, phone, status, relationship_status, source,
    connected_group_id, business_id, is_portal_test, owner_name, lat, lon,
    portal_owner_request_status, portal_owner_requested_by, portal_owner_requested_at, portal_owner_target_group, portal_owner_prospect_key)
  VALUES (
    left(COALESCE(nullif(btrim(p_store_name),''), v_pros.store_name, 'New store (owner added)'), 200),
    btrim(p_address), COALESCE(nullif(btrim(p_city),''), v_pros.city), COALESCE(nullif(upper(btrim(p_state)),''), v_pros.state, v_anchor.state),
    COALESCE(v_zip, v_pros.zip), COALESCE(nullif(btrim(p_phone),''), v_pros.phone),
    'prospect', 'Non-active (New - need to speak)', 'store_portal_owner_added',
    v_group, v_anchor.business_id, COALESCE(v_anchor.is_portal_test, false), v_anchor.owner_name, v_pros.lat, v_pros.lon,
    'pending', auth.uid(), now(), v_group, v_pros.prospect_key)
  RETURNING id INTO v_new;
  INSERT INTO public.store_notes (store_id, note_text, created_by, note_date, source)
  VALUES (v_new, 'Added by the owner of ' || COALESCE(v_anchor.store_name,'a linked store') || ' in the store portal. Waiting for Ching to approve before orders.'
    || CASE WHEN v_pros.prospect_key IS NOT NULL THEN ' Matches prospect list entry ' || v_pros.prospect_key || '.' ELSE '' END,
    auth.uid(), CURRENT_DATE, 'store_portal');
  RETURN jsonb_build_object('result', CASE WHEN v_pros.prospect_key IS NOT NULL THEN 'created_from_prospect' ELSE 'created' END, 'store_id', v_new);
END $$;
GRANT EXECUTE ON FUNCTION public.store_portal_add_owner_store(uuid, text, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.store_portal_owner_pending_stores()
RETURNS TABLE(store_id uuid, store_name text, address text, city text, state text, zip text, phone text,
  kind text, requested_at timestamptz, requested_by_store text, is_portal_test boolean, prospect_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT sm.id, sm.store_name, sm.address, sm.city, sm.state, sm.zip, sm.phone,
    CASE WHEN sm.source = 'store_portal_owner_added' THEN 'new_store' ELSE 'link_existing' END,
    sm.portal_owner_requested_at,
    (SELECT a.store_name FROM public.store_users su JOIN public.store_master a ON a.id = su.store_id
      WHERE su.user_id = sm.portal_owner_requested_by ORDER BY su.created_at LIMIT 1),
    COALESCE(sm.is_portal_test, false), sm.portal_owner_prospect_key
  FROM public.store_master sm
  WHERE (public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))
    AND sm.portal_owner_request_status = 'pending' AND sm.deleted_at IS NULL
  ORDER BY sm.portal_owner_requested_at
$$;
GRANT EXECUTE ON FUNCTION public.store_portal_owner_pending_stores() TO authenticated;

CREATE OR REPLACE FUNCTION public.store_portal_owner_review_store(p_store_id uuid, p_approve boolean, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v public.store_master%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Only the owner can approve stores';
  END IF;
  SELECT * INTO v FROM public.store_master WHERE id = p_store_id FOR UPDATE;
  IF NOT FOUND OR v.portal_owner_request_status IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'No pending request for this store'; END IF;
  IF p_approve AND v.source <> 'store_portal_owner_added' THEN
    IF v.connected_group_id IS NOT NULL AND v.connected_group_id <> v.portal_owner_target_group THEN
      RAISE EXCEPTION 'This store is already in a different owner group; link it by hand';
    END IF;
    UPDATE public.store_master SET connected_group_id = v.portal_owner_target_group WHERE id = p_store_id;
  END IF;
  IF p_approve AND v.portal_owner_prospect_key IS NOT NULL THEN
    UPDATE public.store_prospects SET promoted_store_id = p_store_id, promoted_at = now(), promoted_by = auth.uid(), prospect_status = 'promoted'
     WHERE prospect_key = v.portal_owner_prospect_key AND promoted_store_id IS NULL;
  END IF;
  UPDATE public.store_master SET portal_owner_request_status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    portal_owner_reviewed_by = auth.uid(), portal_owner_reviewed_at = now(), portal_owner_review_note = left(p_note, 500)
   WHERE id = p_store_id;
  INSERT INTO public.store_notes (store_id, note_text, created_by, note_date, source)
  VALUES (p_store_id, CASE WHEN p_approve THEN 'Ching approved this owner-added store for portal orders.' ELSE 'Ching rejected this owner-added store request (record kept).' END
    || COALESCE(' Note: ' || nullif(p_note,''), ''), auth.uid(), CURRENT_DATE, 'store_portal');
  RETURN jsonb_build_object('success', true, 'status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END);
END $$;
GRANT EXECUTE ON FUNCTION public.store_portal_owner_review_store(uuid, boolean, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.store_portal_store_orderable(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.store_portal_send_order_batch(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.store_portal_owner_requests() FROM anon;
REVOKE EXECUTE ON FUNCTION public.store_portal_owner_stores() FROM anon;
REVOKE EXECUTE ON FUNCTION public.store_portal_add_owner_store(uuid, text, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.store_portal_owner_pending_stores() FROM anon;
REVOKE EXECUTE ON FUNCTION public.store_portal_owner_review_store(uuid, boolean, text) FROM anon;