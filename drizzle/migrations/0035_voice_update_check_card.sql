ALTER TABLE public.store_voice_notes
  ADD COLUMN IF NOT EXISTS check_card jsonb,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS saved_result jsonb,
  ADD COLUMN IF NOT EXISTS processing_error text;
ALTER TABLE public.store_voice_notes DROP CONSTRAINT IF EXISTS store_voice_notes_status_check;
ALTER TABLE public.store_voice_notes ADD CONSTRAINT store_voice_notes_status_check
  CHECK (status IN ('uploaded','transcribing','transcribed','analyzed','ready_for_confirmation','confirmed','failed'));
CREATE INDEX IF NOT EXISTS idx_store_voice_notes_created_by_day ON public.store_voice_notes(created_by, created_at DESC);

ALTER TABLE public.delivery_requests DROP CONSTRAINT IF EXISTS delivery_requests_source_check;
ALTER TABLE public.delivery_requests ADD CONSTRAINT delivery_requests_source_check CHECK (source IN ('store_portal','field_order_request','voice_order_request'));
ALTER TABLE public.pending_route_stops DROP CONSTRAINT IF EXISTS pending_route_stops_signal_source_check;
ALTER TABLE public.pending_route_stops ADD CONSTRAINT pending_route_stops_signal_source_check CHECK (signal_source IS NULL OR signal_source = ANY (ARRAY['ai_score','sell_through','brand_crm','opportunities','ai_call_outcome','sms_outcome','manual_disposition','owner_order','coverage_gap','manual','store_portal','field_order_request','voice_order_request']));
ALTER TABLE public.pending_route_stops DROP CONSTRAINT IF EXISTS prs_signal_source_chk;
ALTER TABLE public.pending_route_stops ADD CONSTRAINT prs_signal_source_chk CHECK (signal_source IS NULL OR signal_source = ANY (ARRAY['ai_score','sell_through','brand_crm','opportunities','ai_call_outcome','sms_outcome','manual_disposition','owner_order','coverage_gap','manual','store_portal','field_order_request','voice_order_request']));

CREATE OR REPLACE FUNCTION public.store_voice_update_can_access(p_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND (public.is_staff(auth.uid()) OR public.field_order_is_owner(auth.uid()) OR public.ambassador_has_store_access(auth.uid(), p_store_id));
$$;
REVOKE ALL ON FUNCTION public.store_voice_update_can_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_voice_update_can_access(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.store_voice_update_create(p_store_id uuid, p_file_url text, p_duration_seconds integer DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_uid uuid := auth.uid(); v_prefix text;
BEGIN
  IF v_uid IS NULL OR NOT public.store_voice_update_can_access(p_store_id) THEN RAISE EXCEPTION 'You do not have access to this store'; END IF;
  v_prefix := v_uid::text || '/' || p_store_id::text || '/';
  IF p_file_url IS NULL OR p_file_url NOT LIKE v_prefix || '%.wav' OR length(p_file_url) > 500 THEN RAISE EXCEPTION 'Invalid private audio path'; END IF;
  IF p_duration_seconds IS NOT NULL AND (p_duration_seconds < 1 OR p_duration_seconds > 180) THEN RAISE EXCEPTION 'Recording must be between 1 second and 3 minutes'; END IF;
  INSERT INTO public.store_voice_notes(store_id,file_url,created_by,duration_seconds,status)
    VALUES(p_store_id,p_file_url,v_uid,p_duration_seconds,'uploaded') RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.store_voice_update_create(uuid,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_voice_update_create(uuid,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.store_voice_update_nearest(p_lat numeric, p_lng numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'Valid location and sign in required'; END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(n)) FROM (
    SELECT s.id AS store_id, s.name AS store_name, concat_ws(', ',s.address_street,s.address_city,s.address_state,s.address_zip) AS address,
      round((6371000 * 2 * asin(sqrt(power(sin(radians(s.lat-p_lat)/2),2) + cos(radians(p_lat))*cos(radians(s.lat))*power(sin(radians(s.lng-p_lng)/2),2))))::numeric,1) AS distance_m
    FROM public.stores s
    WHERE s.deleted_at IS NULL AND s.approval_status='approved' AND s.lat IS NOT NULL AND s.lng IS NOT NULL
      AND public.store_voice_update_can_access(s.id)
    ORDER BY distance_m LIMIT 2
  ) n),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.store_voice_update_nearest(numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_voice_update_nearest(numeric,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.delivery_request_to_pending_stop()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _id uuid; _name text; _when text; _items text; _boxes numeric; _field boolean := NEW.source IN ('field_order_request','voice_order_request');
BEGIN
  SELECT name INTO _name FROM public.stores WHERE id = NEW.store_id;
  IF _name IS NULL THEN SELECT store_name INTO _name FROM public.store_master WHERE id = NEW.store_id; END IF;
  _when := CASE WHEN NEW.request_type = 'asap' THEN CASE WHEN _field THEN 'next visit' ELSE 'ASAP' END ELSE to_char(NEW.requested_date, 'Mon DD') END;
  IF _field THEN
    _items := public.field_order_items_text(NEW.items);
    SELECT sum(coalesce(nullif(e->>'quantity','')::numeric,0)) INTO _boxes FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.items)='array' THEN NEW.items ELSE '[]'::jsonb END) e;
  ELSE
    SELECT string_agg(coalesce(e->>'quantity', e->>'qty', '1') || ' x ' || coalesce(e->>'name', e->>'product_name', e->>'label', 'item') || coalesce(' (' || (e->>'unit') || ')', ''), ', '), sum(coalesce(nullif(e->>'quantity','')::numeric, nullif(e->>'qty','')::numeric, 0)) INTO _items, _boxes FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.items) = 'array' THEN NEW.items ELSE '[]'::jsonb END) e;
  END IF;
  INSERT INTO public.pending_route_stops (store_id, store_name, signal_source, reason, source_ref, business, priority, urgency, requested_day, requested_window, intent_summary, recommended_boxes, status, ai_payload)
  VALUES (NEW.store_id, _name, NEW.source, CASE WHEN NEW.source='voice_order_request' THEN 'Voice order request — ' WHEN _field THEN 'Field order request — ' ELSE 'Store portal delivery request — ' END || _when || coalesce(' (' || NEW.time_window || ')', ''), 'delivery_request:' || NEW.id, 'gasmask', CASE WHEN NEW.request_type = 'asap' THEN 5 ELSE 4 END, CASE WHEN NEW.request_type = 'asap' THEN 'today' WHEN NEW.requested_date <= current_date + 7 THEN 'this_week' ELSE 'next_week' END, CASE WHEN NEW.request_type = 'asap' THEN 'ASAP' ELSE NEW.requested_date::text END, NEW.time_window, coalesce(_items, 'Delivery requested') || coalesce(' — Note: ' || NEW.notes, ''), nullif(ceil(coalesce(_boxes,0))::int, 0), 'pending_approval', jsonb_build_object('source', NEW.source, 'delivery_request_id', NEW.id, 'items', NEW.items, 'requested_date', NEW.requested_date, 'requested_by', NEW.requested_by)) RETURNING id INTO _id;
  UPDATE public.delivery_requests SET pending_route_stop_id = _id WHERE id = NEW.id;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.pending_stop_to_delivery_request_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.signal_source NOT IN ('store_portal','field_order_request','voice_order_request') OR NEW.source_ref NOT LIKE 'delivery_request:%' THEN RETURN NEW; END IF;
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.delivery_requests SET status = 'scheduled', updated_at = now(), route_id = coalesce((SELECT rs.route_id FROM public.route_stops rs WHERE rs.id = NEW.route_stop_id), route_id) WHERE id = substr(NEW.source_ref, 18)::uuid AND status IN ('new','confirmed');
  ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    UPDATE public.delivery_requests SET status = 'cancelled', updated_at = now() WHERE id = substr(NEW.source_ref, 18)::uuid AND status IN ('new','confirmed');
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.field_order_request_save(p_store_id uuid, p_items jsonb, p_note text DEFAULT NULL, p_deliver_by text DEFAULT 'next_visit', p_deliver_date date DEFAULT NULL, p_request_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_req public.delivery_requests%ROWTYPE; v_items jsonb := '[]'::jsonb; e jsonb; v_q numeric; v_date date; v_type text; v_text text; v_today date := (now() AT TIME ZONE 'America/New_York')::date; v_note text := nullif(trim(coalesce(p_note,'')),'');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT (public.is_staff(v_uid) OR public.ambassador_has_store_access(v_uid, p_store_id) OR public.field_order_is_owner(v_uid)) THEN RAISE EXCEPTION 'You do not have access to this store'; END IF;
  IF jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'Items must be a list'; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_q := nullif(e->>'quantity','')::numeric;
    IF v_q IS NULL OR v_q <= 0 THEN CONTINUE; END IF;
    IF v_q > 100 OR (v_q*2) <> floor(v_q*2) THEN RAISE EXCEPTION 'Quantity must be in half boxes (max 100)'; END IF;
    IF coalesce(e->>'brand_key','') NOT IN ('gasmask_tubes','gasmask_bags','hotmama','hotscolatti','grabba_r_us') THEN RAISE EXCEPTION 'Unknown brand %', e->>'brand_key'; END IF;
    v_items := v_items || jsonb_build_object('brand_key', e->>'brand_key', 'product_id', nullif(e->>'product_id',''), 'name', left(coalesce(e->>'name','item'),80), 'quantity', v_q, 'unit', 'box', 'store_price', nullif(e->>'store_price','')::numeric);
  END LOOP;
  IF jsonb_array_length(v_items) = 0 THEN RAISE EXCEPTION 'Pick at least one quantity'; END IF;
  IF p_deliver_by NOT IN ('next_visit','tomorrow','date') THEN RAISE EXCEPTION 'Invalid deliver-by'; END IF;
  v_date := CASE p_deliver_by WHEN 'tomorrow' THEN v_today + 1 WHEN 'date' THEN p_deliver_date END;
  IF p_deliver_by = 'date' AND (v_date IS NULL OR v_date < v_today) THEN RAISE EXCEPTION 'Pick a delivery date from today on'; END IF;
  v_type := CASE WHEN v_date IS NULL THEN 'asap' ELSE 'scheduled' END; v_text := public.field_order_items_text(v_items);
  IF p_request_id IS NOT NULL THEN
    SELECT * INTO v_req FROM public.delivery_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND OR v_req.source NOT IN ('field_order_request','voice_order_request') THEN RAISE EXCEPTION 'Order request not found'; END IF;
    IF v_req.requested_by IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Only the person who made this request can edit it'; END IF;
    IF (v_req.created_at AT TIME ZONE 'America/New_York')::date <> v_today THEN RAISE EXCEPTION 'Requests can only be edited the same day'; END IF;
    IF v_req.status <> 'new' THEN RAISE EXCEPTION 'This request is already %', v_req.status; END IF;
    UPDATE public.delivery_requests SET items = v_items, notes = v_note, deliver_by = p_deliver_by, requested_date = v_date, request_type = v_type WHERE id = p_request_id RETURNING * INTO v_req;
    UPDATE public.pending_route_stops SET intent_summary = v_text || coalesce(' — Note: ' || v_note, ''), requested_day = CASE WHEN v_date IS NULL THEN 'ASAP' ELSE v_date::text END, ai_payload = coalesce(ai_payload,'{}'::jsonb) || jsonb_build_object('items', v_items, 'requested_date', v_date), updated_at = now() WHERE id = v_req.pending_route_stop_id AND status = 'pending_approval';
    INSERT INTO public.store_notes (store_id, note_text, created_by, note_date, source) VALUES (p_store_id, 'Order request updated: ' || v_text || coalesce(' - note: ' || v_note, ''), v_uid, now(), v_req.source);
  ELSE
    INSERT INTO public.delivery_requests (store_id, requested_by, request_type, requested_date, items, notes, status, source, deliver_by) VALUES (p_store_id, v_uid, v_type, v_date, v_items, v_note, 'new', 'field_order_request', p_deliver_by) RETURNING * INTO v_req;
    INSERT INTO public.store_notes (store_id, note_text, created_by, note_date, source) VALUES (p_store_id, 'Order request: ' || v_text || coalesce(' - note: ' || v_note, ''), v_uid, now(), 'field_order_request');
  END IF;
  UPDATE public.store_master SET needs_order = true WHERE id = p_store_id AND needs_order IS DISTINCT FROM true;
  RETURN jsonb_build_object('id', v_req.id, 'status', v_req.status, 'items', v_req.items, 'summary', v_text);
END $$;

CREATE OR REPLACE FUNCTION public.field_order_request_cancel(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_req public.delivery_requests%ROWTYPE; v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO v_req FROM public.delivery_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.source NOT IN ('field_order_request','voice_order_request') THEN RAISE EXCEPTION 'Order request not found'; END IF;
  IF v_req.requested_by IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Only the person who made this request can cancel it'; END IF;
  IF (v_req.created_at AT TIME ZONE 'America/New_York')::date <> (now() AT TIME ZONE 'America/New_York')::date THEN RAISE EXCEPTION 'Requests can only be cancelled the same day'; END IF;
  IF v_req.status <> 'new' THEN RAISE EXCEPTION 'This request is already %', v_req.status; END IF;
  UPDATE public.delivery_requests SET status = 'cancelled' WHERE id = p_request_id;
  INSERT INTO public.store_notes (store_id, note_text, created_by, note_date, source) VALUES (v_req.store_id, 'Order request cancelled: ' || public.field_order_items_text(v_req.items), v_uid, now(), v_req.source);
  RETURN jsonb_build_object('id', p_request_id, 'status', 'cancelled');
END $$;

CREATE OR REPLACE FUNCTION public.field_order_requests_list(p_from date DEFAULT NULL, p_to date DEFAULT NULL, p_requested_by uuid DEFAULT NULL, p_store_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_owner boolean; v_from date; v_to date; v_today date := (now() AT TIME ZONE 'America/New_York')::date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  v_owner := public.field_order_is_owner(v_uid); v_from := coalesce(p_from, v_today); v_to := coalesce(p_to, v_from);
  RETURN jsonb_build_object('is_owner', v_owner, 'today', v_today, 'requests', coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'store_id', d.store_id, 'store_name', coalesce(sm.store_name, s.name), 'address', concat_ws(', ', sm.address, sm.city, sm.state, sm.zip), 'lat', s.lat, 'lng', s.lng, 'items', d.items, 'notes', d.notes, 'status', d.status, 'deliver_by', d.deliver_by, 'requested_date', d.requested_date, 'created_at', d.created_at, 'requested_by', d.requested_by, 'route_id', d.route_id, 'source', d.source, 'requested_by_name', coalesce((SELECT a.name FROM public.ambassadors a WHERE a.user_id = d.requested_by LIMIT 1), (SELECT p.name FROM public.profiles p WHERE p.id = d.requested_by), (SELECT p.email FROM public.profiles p WHERE p.id = d.requested_by)), 'contact', (SELECT jsonb_build_object('name', c.name, 'phone', c.phone) FROM public.store_contacts c WHERE c.store_id = d.store_id AND c.phone IS NOT NULL ORDER BY (c.number_verification_status='confirmed') DESC NULLS LAST, c.created_at LIMIT 1), 'store_phone', sm.phone, 'can_edit', d.requested_by = v_uid AND d.status = 'new' AND (d.created_at AT TIME ZONE 'America/New_York')::date = v_today) ORDER BY coalesce(sm.store_name, s.name), d.created_at) FROM public.delivery_requests d LEFT JOIN public.store_master sm ON sm.id = d.store_id LEFT JOIN public.stores s ON s.id = d.store_id WHERE d.source IN ('field_order_request','voice_order_request') AND (d.created_at AT TIME ZONE 'America/New_York')::date BETWEEN v_from AND v_to AND (p_store_id IS NULL OR d.store_id = p_store_id) AND (CASE WHEN v_owner THEN (p_requested_by IS NULL OR d.requested_by = p_requested_by) WHEN p_store_id IS NOT NULL THEN (d.requested_by = v_uid OR public.is_staff(v_uid) OR public.ambassador_has_store_access(v_uid, p_store_id)) ELSE d.requested_by = v_uid END)), '[]'::jsonb), 'requesters', CASE WHEN v_owner THEN coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object('id', d.requested_by, 'name', coalesce((SELECT a.name FROM public.ambassadors a WHERE a.user_id = d.requested_by LIMIT 1), (SELECT p.email FROM public.profiles p WHERE p.id = d.requested_by)))) FROM public.delivery_requests d WHERE d.source IN ('field_order_request','voice_order_request') AND d.requested_by IS NOT NULL AND d.created_at > now() - interval '60 days'), '[]'::jsonb) ELSE '[]'::jsonb END);
END $$;

CREATE OR REPLACE FUNCTION public.field_order_mark_delivered(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_req public.delivery_requests%ROWTYPE; v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO v_req FROM public.delivery_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.source NOT IN ('field_order_request','voice_order_request') THEN RAISE EXCEPTION 'Order request not found'; END IF;
  IF NOT (public.field_order_is_owner(v_uid) OR public.is_staff(v_uid) OR v_req.requested_by = v_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF v_req.status NOT IN ('new','confirmed','scheduled') THEN RAISE EXCEPTION 'This request is already %', v_req.status; END IF;
  UPDATE public.delivery_requests SET status = 'delivered', delivered_at = now() WHERE id = p_request_id;
  UPDATE public.pending_route_stops SET status = 'approved', approved_by = coalesce(approved_by, v_uid), approved_at = coalesce(approved_at, now()) WHERE id = v_req.pending_route_stop_id AND status = 'pending_approval';
  INSERT INTO public.store_notes (store_id, note_text, created_by, note_date, source) VALUES (v_req.store_id, 'Order request delivered: ' || public.field_order_items_text(v_req.items), v_uid, now(), v_req.source);
  RETURN jsonb_build_object('id', p_request_id, 'status', 'delivered');
END $$;

CREATE OR REPLACE FUNCTION public.field_order_build_route(p_request_ids uuid[], p_route_date date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_owner boolean; v_assignee uuid; v_route uuid; v_date date := coalesce(p_route_date, (now() AT TIME ZONE 'America/New_York')::date + 1); r record; v_order int := 0; v_stop uuid; v_name text; v_seen uuid[] := '{}'; v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF; v_owner := public.field_order_is_owner(v_uid);
  SELECT count(DISTINCT requested_by), min(requested_by::text)::uuid INTO v_count, v_assignee FROM public.delivery_requests WHERE id = ANY(p_request_ids) AND source IN ('field_order_request','voice_order_request') AND status IN ('new','confirmed');
  IF v_assignee IS NULL THEN RAISE EXCEPTION 'No open order requests selected'; END IF; IF v_count > 1 THEN RAISE EXCEPTION 'Pick one ambassador before building a route'; END IF; IF NOT v_owner AND v_assignee <> v_uid THEN RAISE EXCEPTION 'You can only build routes from your own requests'; END IF;
  v_name := coalesce((SELECT a.name FROM public.ambassadors a WHERE a.user_id = v_assignee LIMIT 1), 'Ambassador');
  INSERT INTO public.routes (date, type, assigned_to, status, route_state, name, notes, created_by, source) VALUES (v_date, 'delivery', v_assignee, 'active', 'draft', 'DRAFT Order deliveries ' || to_char(v_date,'Mon DD') || ' - ' || v_name, 'Built from field order requests', v_uid, 'manual') RETURNING id INTO v_route;
  FOR r IN SELECT d.*, ord FROM unnest(p_request_ids) WITH ORDINALITY u(id, ord) JOIN public.delivery_requests d ON d.id = u.id WHERE d.source IN ('field_order_request','voice_order_request') AND d.status IN ('new','confirmed') ORDER BY ord LOOP
    IF NOT (r.store_id = ANY(v_seen)) AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = r.store_id) THEN
      v_order := v_order + 1; v_seen := v_seen || r.store_id;
      INSERT INTO public.route_stops (route_id, store_id, planned_order, status, stop_reason, notes_to_worker, lat, lng) SELECT v_route, r.store_id, v_order, 'pending', 'DELIVER|order request', public.field_order_items_text(r.items), s.lat, s.lng FROM public.stores s WHERE s.id = r.store_id RETURNING id INTO v_stop;
    ELSE SELECT id INTO v_stop FROM public.route_stops WHERE route_id = v_route AND store_id = r.store_id; END IF;
    IF v_stop IS NOT NULL THEN
      UPDATE public.pending_route_stops SET status='approved', route_stop_id = v_stop, approved_by = v_uid, approved_at = now() WHERE id = r.pending_route_stop_id AND status='pending_approval';
      UPDATE public.delivery_requests SET status='scheduled', route_id = v_route, assigned_to = v_assignee WHERE id = r.id AND status IN ('new','confirmed');
    END IF;
  END LOOP;
  IF v_order = 0 THEN RAISE EXCEPTION 'None of these stores can be placed on a route'; END IF;
  RETURN jsonb_build_object('route_id', v_route, 'stops', v_order, 'assigned_to', v_assignee);
END $$;

CREATE OR REPLACE FUNCTION public.field_order_daily_summary(p_date date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH d AS (SELECT * FROM public.delivery_requests WHERE source IN ('field_order_request','voice_order_request') AND status <> 'cancelled' AND (created_at AT TIME ZONE 'America/New_York')::date = p_date)
  SELECT jsonb_build_object('date', p_date, 'requests', (SELECT count(*) FROM d), 'stores', (SELECT count(DISTINCT store_id) FROM d), 'ambassadors', (SELECT count(DISTINCT requested_by) FROM d), 'brands', coalesce((SELECT jsonb_object_agg(name, boxes) FROM (SELECT e->>'name' name, sum((e->>'quantity')::numeric) boxes FROM d, jsonb_array_elements(d.items) e GROUP BY 1) b), '{}'::jsonb))
$$;

CREATE OR REPLACE FUNCTION public.store_voice_update_confirm(p_note_id uuid, p_card jsonb, p_transcript text DEFAULT NULL, p_gps_lat numeric DEFAULT NULL, p_gps_lng numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_note public.store_voice_notes%ROWTYPE; v_uid uuid:=auth.uid(); v_store public.store_master%ROWTYPE;
  v_counts jsonb := coalesce(p_card->'counts','[]'::jsonb); v_item jsonb; v_brand text; v_count int; v_brand_name text;
  v_allowed text[] := ARRAY['gasmasktubes','gasmask','hotmama','grabba_r_us','hotscolatti-light','hotscolatti-dark','hotscalatimixpack','hotscalatibros'];
  v_names jsonb := '{"gasmasktubes":"GasMask Tubes","gasmask":"GasMask Bags","hotmama":"Hot Mama","grabba_r_us":"Grabba R Us","hotscolatti-light":"Hotscolatti Light","hotscolatti-dark":"Hotscolatti Dark","hotscalatimixpack":"Hotscolatti Mix Pack","hotscalatibros":"Hotscolatti Bros"}'::jsonb;
  v_saved_counts jsonb := '[]'::jsonb; v_order jsonb; v_order_id uuid; v_contact jsonb; v_contact_id uuid; v_phone text; v_same_phone boolean;
  v_leads jsonb := '[]'::jsonb; v_lead jsonb; v_group uuid; v_lead_store uuid; v_match_count int; v_lead_results jsonb := '[]'::jsonb;
  v_status text; v_relationship text; v_ambassador_id uuid; v_visit_id uuid; v_store_note_id uuid; v_role text;
  v_summary text := left(coalesce(nullif(trim(p_card->>'summary'),''),'Voice update'),500); v_transcript text := left(coalesce(p_transcript,v_note.transcript,''),20000);
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO v_note FROM public.store_voice_notes WHERE id=p_note_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voice update not found'; END IF;
  IF v_note.status='confirmed' AND v_note.confirmed_at IS NOT NULL THEN RETURN coalesce(v_note.saved_result,jsonb_build_object('note_id',v_note.id,'idempotent',true)); END IF;
  IF v_note.status<>'ready_for_confirmation' THEN RAISE EXCEPTION 'This voice update is not ready to confirm'; END IF;
  IF v_note.created_by IS DISTINCT FROM v_uid AND NOT public.field_order_is_owner(v_uid) THEN RAISE EXCEPTION 'Only the person who recorded this update can confirm it'; END IF;
  IF NOT public.store_voice_update_can_access(v_note.store_id) THEN RAISE EXCEPTION 'You do not have access to this store'; END IF;
  IF p_card IS NULL OR p_card->>'store_id' IS DISTINCT FROM v_note.store_id::text THEN RAISE EXCEPTION 'Store does not match this recording'; END IF;
  IF p_gps_lat IS NOT NULL AND (p_gps_lat NOT BETWEEN -90 AND 90 OR p_gps_lng NOT BETWEEN -180 AND 180) THEN RAISE EXCEPTION 'Invalid GPS'; END IF;
  SELECT * INTO v_store FROM public.store_master WHERE id=v_note.store_id;
  SELECT id INTO v_ambassador_id FROM public.ambassadors WHERE user_id=v_uid AND is_active IS TRUE AND deleted_at IS NULL LIMIT 1;

  IF jsonb_typeof(v_counts)<>'array' OR jsonb_array_length(v_counts)>20 THEN RAISE EXCEPTION 'Invalid counts'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_counts) LOOP
    v_brand := v_item->>'brand_id';
    IF NOT (v_brand=ANY(v_allowed)) THEN RAISE EXCEPTION 'Unknown inventory brand'; END IF;
    v_count := (v_item->>'count')::int;
    IF v_count IS NULL OR v_count<0 OR v_count>100000 OR (v_item->>'count')::numeric<>v_count THEN RAISE EXCEPTION 'Invalid count for %',v_brand; END IF;
    v_brand_name := v_names->>v_brand;
    INSERT INTO public.store_tube_inventory_status(store_id,brand_id,brand_name,current_tubes_left,needs_order,last_updated_by,last_updated_by_role,last_updated_method,last_updated_at,tubes_updated_at,last_inventory_check_at,last_inventory_check_by,is_simulation)
      VALUES(v_note.store_id,v_brand,v_brand_name,v_count,v_count<=25,v_uid,coalesce(v_note.check_card->>'actor_role','ambassador'),'voice_update',now(),now(),now(),v_uid,false)
      ON CONFLICT(store_id,brand_id,is_simulation) DO UPDATE SET current_tubes_left=EXCLUDED.current_tubes_left,needs_order=EXCLUDED.needs_order,last_updated_by=EXCLUDED.last_updated_by,last_updated_by_role=EXCLUDED.last_updated_by_role,last_updated_method=EXCLUDED.last_updated_method,last_updated_at=now(),tubes_updated_at=now(),last_inventory_check_at=now(),last_inventory_check_by=EXCLUDED.last_inventory_check_by;
    v_saved_counts := v_saved_counts || jsonb_build_object('brand_id',v_brand,'brand_name',v_brand_name,'count',v_count);
  END LOOP;

  IF coalesce((p_card->'order'->>'requested')::boolean,false) THEN
    v_order := public.field_order_request_save(v_note.store_id,coalesce(p_card->'order'->'items','[]'::jsonb),nullif(p_card->'order'->>'note',''),coalesce(p_card->'order'->>'deliver_by','next_visit'),nullif(p_card->'order'->>'deliver_date','')::date,NULL);
    v_order_id := (v_order->>'id')::uuid;
    UPDATE public.delivery_requests SET source='voice_order_request',updated_at=now() WHERE id=v_order_id;
    UPDATE public.pending_route_stops SET signal_source='voice_order_request',reason=replace(reason,'Field order request','Voice order request'),ai_payload=coalesce(ai_payload,'{}'::jsonb)||jsonb_build_object('source','voice_order_request','voice_note_id',v_note.id),updated_at=now() WHERE id=(SELECT pending_route_stop_id FROM public.delivery_requests WHERE id=v_order_id);
  END IF;

  v_contact := p_card->'contact';
  IF coalesce((v_contact->>'mentioned')::boolean,false) THEN
    IF length(trim(coalesce(v_contact->>'name',''))) NOT BETWEEN 1 AND 150 THEN RAISE EXCEPTION 'Contact name is required'; END IF;
    v_phone := public.normalize_phone_e164(v_contact->>'phone');
    IF v_phone IS NULL THEN RAISE EXCEPTION 'A valid contact phone is required'; END IF;
    v_role := CASE WHEN v_contact->>'role' IN ('owner','manager','worker') THEN v_contact->>'role' ELSE 'worker' END;
    IF nullif(v_contact->>'contact_id','') IS NOT NULL THEN
      SELECT id, right(regexp_replace(coalesce(phone,''),'\D','','g'),10)=right(regexp_replace(v_phone,'\D','','g'),10) INTO v_contact_id,v_same_phone FROM public.store_contacts WHERE id=(v_contact->>'contact_id')::uuid AND store_id=v_note.store_id AND deleted_at IS NULL;
      IF v_contact_id IS NOT NULL AND v_same_phone THEN
        UPDATE public.store_contacts SET name=trim(v_contact->>'name'),role=v_role,updated_by=v_uid WHERE id=v_contact_id;
      ELSE v_contact_id := NULL; END IF;
    END IF;
    IF v_contact_id IS NULL THEN v_contact_id := public.contact_verification_save(v_note.store_id,trim(v_contact->>'name'),v_role,v_phone); END IF;
    UPDATE public.store_contacts SET name=trim(v_contact->>'name'),role=v_role,updated_by=v_uid WHERE id=v_contact_id;
  ELSE v_contact_id := NULL; END IF;

  SELECT connected_group_id INTO v_group FROM public.stores WHERE id=v_note.store_id;
  IF jsonb_typeof(coalesce(p_card->'leads','[]'::jsonb))<>'array' OR jsonb_array_length(coalesce(p_card->'leads','[]'::jsonb))>10 THEN RAISE EXCEPTION 'Invalid other-store leads'; END IF;
  FOR v_lead IN SELECT * FROM jsonb_array_elements(coalesce(p_card->'leads','[]'::jsonb)) LOOP
    IF length(trim(coalesce(v_lead->>'name','')))=0 OR length(trim(coalesce(v_lead->>'address','')))=0 OR length(trim(coalesce(v_lead->>'city','')))=0 OR length(trim(coalesce(v_lead->>'state','')))=0 THEN RAISE EXCEPTION 'Each other-store lead needs name, street, city and state'; END IF;
    SELECT count(*) INTO v_match_count FROM public.stores WHERE deleted_at IS NULL AND lower(name)=lower(trim(v_lead->>'name')) AND lower(coalesce(address_street,''))=lower(trim(v_lead->>'address')) AND lower(coalesce(address_city,''))=lower(trim(v_lead->>'city')) AND lower(coalesce(address_state,''))=lower(trim(v_lead->>'state'));
    IF v_match_count>1 THEN
      v_lead_results := v_lead_results || jsonb_build_object('name',v_lead->>'name','status','needs_review_duplicate_matches'); CONTINUE;
    END IF;
    IF v_match_count=1 THEN
      SELECT id,connected_group_id INTO v_lead_store,v_group FROM public.stores WHERE deleted_at IS NULL AND lower(name)=lower(trim(v_lead->>'name')) AND lower(coalesce(address_street,''))=lower(trim(v_lead->>'address')) AND lower(coalesce(address_city,''))=lower(trim(v_lead->>'city')) AND lower(coalesce(address_state,''))=lower(trim(v_lead->>'state')) LIMIT 1;
      IF v_group IS NOT NULL AND (SELECT connected_group_id FROM public.stores WHERE id=v_note.store_id) IS NOT NULL AND v_group IS DISTINCT FROM (SELECT connected_group_id FROM public.stores WHERE id=v_note.store_id) THEN
        v_lead_results := v_lead_results || jsonb_build_object('name',v_lead->>'name','status','needs_review_existing_group'); CONTINUE;
      END IF;
    ELSE
      v_lead_store := NULL;
    END IF;
    v_group := coalesce((SELECT connected_group_id FROM public.stores WHERE id=v_note.store_id),v_group,gen_random_uuid());
    UPDATE public.stores SET connected_group_id=v_group WHERE id=v_note.store_id AND connected_group_id IS NULL;
    UPDATE public.store_master SET connected_group_id=v_group WHERE id=v_note.store_id AND connected_group_id IS NULL;
    IF v_lead_store IS NULL THEN
      INSERT INTO public.stores(name,type,address_street,address_city,address_state,status,approval_status,captured_by_user_id,captured_at,captured_role,approved_by_user_id,approved_at,connected_group_id)
        VALUES(trim(v_lead->>'name'),'other',trim(v_lead->>'address'),trim(v_lead->>'city'),upper(trim(v_lead->>'state')),'prospect','approved',v_uid,now(),CASE WHEN v_ambassador_id IS NOT NULL THEN 'ambassador' ELSE 'admin' END,v_uid,now(),v_group) RETURNING id INTO v_lead_store;
    ELSE
      UPDATE public.stores SET connected_group_id=v_group WHERE id=v_lead_store AND connected_group_id IS NULL;
    END IF;
    UPDATE public.store_master SET connected_group_id=v_group WHERE id=v_lead_store;
    v_leads := v_leads || to_jsonb(v_lead_store);
    v_lead_results := v_lead_results || jsonb_build_object('store_id',v_lead_store,'name',v_lead->>'name','status','connected');
  END LOOP;

  v_status := nullif(p_card->>'status_change','');
  IF v_status IS NOT NULL THEN
    v_relationship := CASE v_status WHEN 'closed' THEN 'Closed permanently' WHEN 'no_tobacco' THEN 'No tobacco' WHEN 'not_interested' THEN 'Not interested' ELSE NULL END;
    IF v_relationship IS NULL THEN RAISE EXCEPTION 'Invalid status change'; END IF;
    UPDATE public.store_master SET relationship_status=v_relationship WHERE id=v_note.store_id;
  END IF;

  INSERT INTO public.store_notes(store_id,note_text,created_by,note_date,source,ambassador_id)
    VALUES(v_note.store_id,'VOICE UPDATE: '||v_summary||E'\n\nTranscript: '||v_transcript,v_uid,now(),'voice_update',v_ambassador_id) RETURNING id INTO v_store_note_id;
  INSERT INTO public.store_visits(store_id,visited_by,visit_type,role_type,started_at,completed_at,status,notes,payment_collected,amount_collected,gps_lat,gps_lng)
    VALUES(v_note.store_id,v_uid,'check',CASE WHEN v_ambassador_id IS NOT NULL THEN 'ambassador' ELSE 'admin' END,now(),now(),'completed','Voice update: '||v_summary,false,0,p_gps_lat,p_gps_lng) RETURNING id INTO v_visit_id;

  v_result := jsonb_build_object('note_id',v_note.id,'store_id',v_note.store_id,'counts',v_saved_counts,'order_request_id',v_order_id,'contact_id',v_contact_id,'leads',v_lead_results,'status_change',v_status,'store_note_id',v_store_note_id,'visit_id',v_visit_id,'summary',v_summary,'money_requires_normal_screen',coalesce((p_card->'money'->>'mentioned')::boolean,false));
  UPDATE public.store_voice_notes SET check_card=p_card,transcript=v_transcript,summary=v_summary,status='confirmed',confirmed_at=now(),saved_result=v_result,processing_error=NULL,updated_at=now() WHERE id=v_note.id;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.store_voice_update_confirm(uuid,jsonb,text,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_voice_update_confirm(uuid,jsonb,text,numeric,numeric) TO authenticated;

DROP POLICY IF EXISTS "Users can view voice notes" ON public.store_voice_notes;
DROP POLICY IF EXISTS "Users can insert voice notes" ON public.store_voice_notes;
DROP POLICY IF EXISTS "Users can update voice notes" ON public.store_voice_notes;
DROP POLICY IF EXISTS "Users can delete voice notes" ON public.store_voice_notes;
CREATE POLICY "Voice notes readable by store role" ON public.store_voice_notes FOR SELECT TO authenticated USING (created_by=auth.uid() OR public.store_voice_update_can_access(store_id));
CREATE POLICY "Voice notes inserted by store role" ON public.store_voice_notes FOR INSERT TO authenticated WITH CHECK (created_by=auth.uid() AND public.store_voice_update_can_access(store_id));
CREATE POLICY "Voice notes updated by creator or owner" ON public.store_voice_notes FOR UPDATE TO authenticated USING (created_by=auth.uid() OR public.field_order_is_owner(auth.uid())) WITH CHECK (created_by=auth.uid() OR public.field_order_is_owner(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can upload voice notes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view voice notes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete voice notes" ON storage.objects;
CREATE POLICY "Voice audio uploaded to own store folder" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='store-voice-notes' AND (storage.foldername(name))[1]=auth.uid()::text AND public.store_voice_update_can_access((storage.foldername(name))[2]::uuid));
CREATE POLICY "Voice audio readable by creator or staff" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='store-voice-notes' AND ((storage.foldername(name))[1]=auth.uid()::text OR public.is_staff(auth.uid()) OR public.field_order_is_owner(auth.uid())));

REVOKE ALL ON FUNCTION public.field_order_request_save(uuid,jsonb,text,text,date,uuid), public.field_order_request_cancel(uuid), public.field_order_requests_list(date,date,uuid,uuid), public.field_order_mark_delivered(uuid), public.field_order_build_route(uuid[],date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.field_order_request_save(uuid,jsonb,text,text,date,uuid), public.field_order_request_cancel(uuid), public.field_order_requests_list(date,date,uuid,uuid), public.field_order_mark_delivered(uuid), public.field_order_build_route(uuid[],date) TO authenticated, service_role;
COMMENT ON COLUMN public.store_voice_notes.check_card IS 'AI draft only until confirmed; business writes happen in store_voice_update_confirm.';
COMMENT ON COLUMN public.store_voice_notes.saved_result IS 'Ids and summaries written by the one-time confirmed voice update transaction.';