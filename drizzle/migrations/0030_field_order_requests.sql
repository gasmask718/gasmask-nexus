ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'store_portal';
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS deliver_by text;
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.delivery_requests DROP CONSTRAINT IF EXISTS delivery_requests_source_check;
ALTER TABLE public.delivery_requests ADD CONSTRAINT delivery_requests_source_check CHECK (source IN ('store_portal','field_order_request'));
ALTER TABLE public.delivery_requests DROP CONSTRAINT IF EXISTS delivery_requests_deliver_by_check;
ALTER TABLE public.delivery_requests ADD CONSTRAINT delivery_requests_deliver_by_check CHECK (deliver_by IS NULL OR deliver_by IN ('next_visit','tomorrow','date'));
CREATE INDEX IF NOT EXISTS delivery_requests_source_created_idx ON public.delivery_requests (source, created_at);

ALTER TABLE public.pending_route_stops DROP CONSTRAINT IF EXISTS pending_route_stops_signal_source_check;
ALTER TABLE public.pending_route_stops ADD CONSTRAINT pending_route_stops_signal_source_check CHECK (signal_source IS NULL OR signal_source = ANY (ARRAY['ai_score','sell_through','brand_crm','opportunities','ai_call_outcome','sms_outcome','manual_disposition','owner_order','coverage_gap','manual','store_portal','field_order_request']));

CREATE OR REPLACE FUNCTION public.field_order_items_text(p_items jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT string_agg(
    CASE (e->>'quantity')::numeric WHEN 0.5 THEN '1/2 box' WHEN 1 THEN '1 box' ELSE trim(to_char((e->>'quantity')::numeric,'FM999990.##')) || ' boxes' END
    || ' ' || coalesce(e->>'name','item'), ', ')
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_items)='array' THEN p_items ELSE '[]'::jsonb END) e
$$;

CREATE OR REPLACE FUNCTION public.delivery_request_to_pending_stop()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE _id uuid; _name text; _when text; _items text; _boxes numeric; _field boolean := NEW.source = 'field_order_request';
BEGIN
  SELECT name INTO _name FROM public.stores WHERE id = NEW.store_id;
  IF _name IS NULL THEN SELECT store_name INTO _name FROM public.store_master WHERE id = NEW.store_id; END IF;
  _when := CASE WHEN NEW.request_type = 'asap' THEN CASE WHEN _field THEN 'next visit' ELSE 'ASAP' END ELSE to_char(NEW.requested_date, 'Mon DD') END;
  IF _field THEN
    _items := public.field_order_items_text(NEW.items);
    SELECT sum(coalesce(nullif(e->>'quantity','')::numeric,0)) INTO _boxes FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.items)='array' THEN NEW.items ELSE '[]'::jsonb END) e;
  ELSE
    SELECT string_agg(coalesce(e->>'quantity', e->>'qty', '1') || ' x ' || coalesce(e->>'name', e->>'product_name', e->>'label', 'item') || coalesce(' (' || (e->>'unit') || ')', ''), ', '),
           sum(coalesce(nullif(e->>'quantity','')::numeric, nullif(e->>'qty','')::numeric, 0))
      INTO _items, _boxes
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.items) = 'array' THEN NEW.items ELSE '[]'::jsonb END) e;
  END IF;
  INSERT INTO public.pending_route_stops (store_id, store_name, signal_source, reason, source_ref, business, priority,
    urgency, requested_day, requested_window, intent_summary, recommended_boxes, status, ai_payload)
  VALUES (NEW.store_id, _name, NEW.source,
    CASE WHEN _field THEN 'Field order request — ' ELSE 'Store portal delivery request — ' END || _when || coalesce(' (' || NEW.time_window || ')', ''),
    'delivery_request:' || NEW.id, 'gasmask',
    CASE WHEN NEW.request_type = 'asap' THEN 5 ELSE 4 END,
    CASE WHEN NEW.request_type = 'asap' THEN 'today'
         WHEN NEW.requested_date <= current_date + 7 THEN 'this_week' ELSE 'next_week' END,
    CASE WHEN NEW.request_type = 'asap' THEN 'ASAP' ELSE NEW.requested_date::text END,
    NEW.time_window,
    coalesce(_items, 'Delivery requested') || coalesce(' — Note: ' || NEW.notes, ''),
    nullif(ceil(coalesce(_boxes,0))::int, 0), 'pending_approval',
    jsonb_build_object('source', NEW.source, 'delivery_request_id', NEW.id, 'items', NEW.items, 'requested_date', NEW.requested_date, 'requested_by', NEW.requested_by))
  RETURNING id INTO _id;
  UPDATE public.delivery_requests SET pending_route_stop_id = _id WHERE id = NEW.id;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.pending_stop_to_delivery_request_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.signal_source NOT IN ('store_portal','field_order_request') OR NEW.source_ref NOT LIKE 'delivery_request:%' THEN RETURN NEW; END IF;
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    UPDATE public.delivery_requests
       SET status = 'scheduled', updated_at = now(),
           route_id = coalesce((SELECT rs.route_id FROM public.route_stops rs WHERE rs.id = NEW.route_stop_id), route_id)
     WHERE id = substr(NEW.source_ref, 18)::uuid AND status IN ('new','confirmed');
  ELSIF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    UPDATE public.delivery_requests SET status = 'cancelled', updated_at = now()
     WHERE id = substr(NEW.source_ref, 18)::uuid AND status IN ('new','confirmed');
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.field_order_is_owner(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(p_user,'owner'::public.app_role) OR public.has_role(p_user,'admin'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.field_order_request_save(
  p_store_id uuid, p_items jsonb, p_note text DEFAULT NULL, p_deliver_by text DEFAULT 'next_visit',
  p_deliver_date date DEFAULT NULL, p_request_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_req public.delivery_requests%ROWTYPE; v_items jsonb := '[]'::jsonb; e jsonb;
  v_q numeric; v_date date; v_type text; v_text text; v_today date := (now() AT TIME ZONE 'America/New_York')::date; v_note text := nullif(trim(coalesce(p_note,'')),'');
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT (public.is_staff(v_uid) OR public.ambassador_has_store_access(v_uid, p_store_id) OR public.field_order_is_owner(v_uid)) THEN
    RAISE EXCEPTION 'You do not have access to this store';
  END IF;
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
  v_type := CASE WHEN v_date IS NULL THEN 'asap' ELSE 'scheduled' END;
  v_text := public.field_order_items_text(v_items);

  IF p_request_id IS NOT NULL THEN
    SELECT * INTO v_req FROM public.delivery_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND OR v_req.source <> 'field_order_request' THEN RAISE EXCEPTION 'Order request not found'; END IF;
    IF v_req.requested_by IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Only the person who made this request can edit it'; END IF;
    IF (v_req.created_at AT TIME ZONE 'America/New_York')::date <> v_today THEN RAISE EXCEPTION 'Requests can only be edited the same day'; END IF;
    IF v_req.status <> 'new' THEN RAISE EXCEPTION 'This request is already %', v_req.status; END IF;
    UPDATE public.delivery_requests SET items = v_items, notes = v_note, deliver_by = p_deliver_by, requested_date = v_date, request_type = v_type
      WHERE id = p_request_id RETURNING * INTO v_req;
    UPDATE public.pending_route_stops SET intent_summary = v_text || coalesce(' — Note: ' || v_note, ''),
        requested_day = CASE WHEN v_date IS NULL THEN 'ASAP' ELSE v_date::text END,
        ai_payload = coalesce(ai_payload,'{}'::jsonb) || jsonb_build_object('items', v_items, 'requested_date', v_date), updated_at = now()
      WHERE id = v_req.pending_route_stop_id AND status = 'pending_approval';
    INSERT INTO public.store_notes (store_id, note_text, created_by, note_date, source)
      VALUES (p_store_id, 'Order request updated: ' || v_text || coalesce(' - note: ' || v_note, ''), v_uid, now(), 'field_order_request');
  ELSE
    INSERT INTO public.delivery_requests (store_id, requested_by, request_type, requested_date, items, notes, status, source, deliver_by)
      VALUES (p_store_id, v_uid, v_type, v_date, v_items, v_note, 'new', 'field_order_request', p_deliver_by)
      RETURNING * INTO v_req;
    INSERT INTO public.store_notes (store_id, note_text, created_by, note_date, source)
      VALUES (p_store_id, 'Order request: ' || v_text || coalesce(' - note: ' || v_note, ''), v_uid, now(), 'field_order_request');
  END IF;
  UPDATE public.store_master SET needs_order = true WHERE id = p_store_id AND needs_order IS DISTINCT FROM true;
  RETURN jsonb_build_object('id', v_req.id, 'status', v_req.status, 'items', v_req.items, 'summary', v_text);
END $$;

CREATE OR REPLACE FUNCTION public.field_order_request_cancel(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_req public.delivery_requests%ROWTYPE; v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO v_req FROM public.delivery_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.source <> 'field_order_request' THEN RAISE EXCEPTION 'Order request not found'; END IF;
  IF v_req.requested_by IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Only the person who made this request can cancel it'; END IF;
  IF (v_req.created_at AT TIME ZONE 'America/New_York')::date <> (now() AT TIME ZONE 'America/New_York')::date THEN RAISE EXCEPTION 'Requests can only be cancelled the same day'; END IF;
  IF v_req.status <> 'new' THEN RAISE EXCEPTION 'This request is already %', v_req.status; END IF;
  UPDATE public.delivery_requests SET status = 'cancelled' WHERE id = p_request_id;
  INSERT INTO public.store_notes (store_id, note_text, created_by, note_date, source)
    VALUES (v_req.store_id, 'Order request cancelled: ' || public.field_order_items_text(v_req.items), v_uid, now(), 'field_order_request');
  RETURN jsonb_build_object('id', p_request_id, 'status', 'cancelled');
END $$;

CREATE OR REPLACE FUNCTION public.field_order_requests_list(p_from date DEFAULT NULL, p_to date DEFAULT NULL, p_requested_by uuid DEFAULT NULL, p_store_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_owner boolean; v_from date; v_to date; v_today date := (now() AT TIME ZONE 'America/New_York')::date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  v_owner := public.field_order_is_owner(v_uid);
  v_from := coalesce(p_from, v_today); v_to := coalesce(p_to, v_from);
  RETURN jsonb_build_object('is_owner', v_owner, 'today', v_today, 'requests', coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', d.id, 'store_id', d.store_id, 'store_name', coalesce(sm.store_name, s.name), 'address', concat_ws(', ', sm.address, sm.city, sm.state, sm.zip),
      'lat', s.lat, 'lng', s.lng, 'items', d.items, 'notes', d.notes, 'status', d.status, 'deliver_by', d.deliver_by, 'requested_date', d.requested_date,
      'created_at', d.created_at, 'requested_by', d.requested_by, 'route_id', d.route_id,
      'requested_by_name', coalesce((SELECT a.name FROM public.ambassadors a WHERE a.user_id = d.requested_by LIMIT 1), (SELECT p.name FROM public.profiles p WHERE p.id = d.requested_by), (SELECT p.email FROM public.profiles p WHERE p.id = d.requested_by)),
      'contact', (SELECT jsonb_build_object('name', c.name, 'phone', c.phone) FROM public.store_contacts c WHERE c.store_id = d.store_id AND c.phone IS NOT NULL ORDER BY (c.number_verification_status='confirmed') DESC NULLS LAST, c.created_at LIMIT 1),
      'store_phone', sm.phone,
      'can_edit', d.requested_by = v_uid AND d.status = 'new' AND (d.created_at AT TIME ZONE 'America/New_York')::date = v_today
    ) ORDER BY coalesce(sm.store_name, s.name), d.created_at)
    FROM public.delivery_requests d
    LEFT JOIN public.store_master sm ON sm.id = d.store_id
    LEFT JOIN public.stores s ON s.id = d.store_id
    WHERE d.source = 'field_order_request'
      AND (d.created_at AT TIME ZONE 'America/New_York')::date BETWEEN v_from AND v_to
      AND (p_store_id IS NULL OR d.store_id = p_store_id)
      AND (CASE WHEN v_owner THEN (p_requested_by IS NULL OR d.requested_by = p_requested_by)
                WHEN p_store_id IS NOT NULL THEN (d.requested_by = v_uid OR public.is_staff(v_uid) OR public.ambassador_has_store_access(v_uid, p_store_id))
                ELSE d.requested_by = v_uid END)
  ), '[]'::jsonb),
  'requesters', CASE WHEN v_owner THEN coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object('id', d.requested_by, 'name', coalesce((SELECT a.name FROM public.ambassadors a WHERE a.user_id = d.requested_by LIMIT 1), (SELECT p.email FROM public.profiles p WHERE p.id = d.requested_by))))
      FROM public.delivery_requests d WHERE d.source='field_order_request' AND d.requested_by IS NOT NULL AND d.created_at > now() - interval '60 days'), '[]'::jsonb) ELSE '[]'::jsonb END);
END $$;

CREATE OR REPLACE FUNCTION public.field_order_mark_delivered(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_req public.delivery_requests%ROWTYPE; v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO v_req FROM public.delivery_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.source <> 'field_order_request' THEN RAISE EXCEPTION 'Order request not found'; END IF;
  IF NOT (public.field_order_is_owner(v_uid) OR public.is_staff(v_uid) OR v_req.requested_by = v_uid) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF v_req.status NOT IN ('new','confirmed','scheduled') THEN RAISE EXCEPTION 'This request is already %', v_req.status; END IF;
  UPDATE public.delivery_requests SET status = 'delivered', delivered_at = now() WHERE id = p_request_id;
  UPDATE public.pending_route_stops SET status = 'approved', approved_by = coalesce(approved_by, v_uid), approved_at = coalesce(approved_at, now())
    WHERE id = v_req.pending_route_stop_id AND status = 'pending_approval';
  INSERT INTO public.store_notes (store_id, note_text, created_by, note_date, source)
    VALUES (v_req.store_id, 'Order request delivered: ' || public.field_order_items_text(v_req.items), v_uid, now(), 'field_order_request');
  RETURN jsonb_build_object('id', p_request_id, 'status', 'delivered');
END $$;

CREATE OR REPLACE FUNCTION public.field_order_build_route(p_request_ids uuid[], p_route_date date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_owner boolean; v_assignee uuid; v_route uuid; v_date date := coalesce(p_route_date, (now() AT TIME ZONE 'America/New_York')::date + 1);
  r record; v_order int := 0; v_stop uuid; v_name text; v_seen uuid[] := '{}'; v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  v_owner := public.field_order_is_owner(v_uid);
  SELECT count(DISTINCT requested_by), min(requested_by::text)::uuid INTO v_count, v_assignee FROM public.delivery_requests
    WHERE id = ANY(p_request_ids) AND source='field_order_request' AND status IN ('new','confirmed');
  IF v_assignee IS NULL THEN RAISE EXCEPTION 'No open order requests selected'; END IF;
  IF v_count > 1 THEN RAISE EXCEPTION 'Pick one ambassador before building a route'; END IF;
  IF NOT v_owner AND v_assignee <> v_uid THEN RAISE EXCEPTION 'You can only build routes from your own requests'; END IF;
  v_name := coalesce((SELECT a.name FROM public.ambassadors a WHERE a.user_id = v_assignee LIMIT 1), 'Ambassador');
  INSERT INTO public.routes (date, type, assigned_to, status, route_state, name, notes, created_by, source)
    VALUES (v_date, 'delivery', v_assignee, 'active', 'draft', 'DRAFT Order deliveries ' || to_char(v_date,'Mon DD') || ' - ' || v_name,
            'Built from field order requests', v_uid, 'manual')
    RETURNING id INTO v_route;
  FOR r IN SELECT d.*, ord FROM unnest(p_request_ids) WITH ORDINALITY u(id, ord) JOIN public.delivery_requests d ON d.id = u.id
           WHERE d.source='field_order_request' AND d.status IN ('new','confirmed') ORDER BY ord LOOP
    IF NOT (r.store_id = ANY(v_seen)) AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = r.store_id) THEN
      v_order := v_order + 1; v_seen := v_seen || r.store_id;
      INSERT INTO public.route_stops (route_id, store_id, planned_order, status, stop_reason, notes_to_worker, lat, lng)
        SELECT v_route, r.store_id, v_order, 'pending', 'DELIVER|order request', public.field_order_items_text(r.items), s.lat, s.lng FROM public.stores s WHERE s.id = r.store_id
        RETURNING id INTO v_stop;
    ELSE
      SELECT id INTO v_stop FROM public.route_stops WHERE route_id = v_route AND store_id = r.store_id;
    END IF;
    IF v_stop IS NOT NULL THEN
      UPDATE public.pending_route_stops SET status='approved', route_stop_id = v_stop, approved_by = v_uid, approved_at = now()
        WHERE id = r.pending_route_stop_id AND status='pending_approval';
      UPDATE public.delivery_requests SET status='scheduled', route_id = v_route, assigned_to = v_assignee WHERE id = r.id AND status IN ('new','confirmed');
    END IF;
  END LOOP;
  IF v_order = 0 THEN RAISE EXCEPTION 'None of these stores can be placed on a route'; END IF;
  RETURN jsonb_build_object('route_id', v_route, 'stops', v_order, 'assigned_to', v_assignee);
END $$;

CREATE OR REPLACE FUNCTION public.field_order_daily_summary(p_date date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH d AS (SELECT * FROM public.delivery_requests WHERE source='field_order_request' AND status <> 'cancelled' AND (created_at AT TIME ZONE 'America/New_York')::date = p_date)
  SELECT jsonb_build_object('date', p_date, 'requests', (SELECT count(*) FROM d), 'stores', (SELECT count(DISTINCT store_id) FROM d),
    'ambassadors', (SELECT count(DISTINCT requested_by) FROM d),
    'brands', coalesce((SELECT jsonb_object_agg(name, boxes) FROM (SELECT e->>'name' name, sum((e->>'quantity')::numeric) boxes FROM d, jsonb_array_elements(d.items) e GROUP BY 1) b), '{}'::jsonb))
$$;

REVOKE ALL ON FUNCTION public.field_order_daily_summary(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.field_order_daily_summary(date) TO service_role;
REVOKE ALL ON FUNCTION public.field_order_request_save(uuid,jsonb,text,text,date,uuid), public.field_order_request_cancel(uuid), public.field_order_requests_list(date,date,uuid,uuid), public.field_order_mark_delivered(uuid), public.field_order_build_route(uuid[],date), public.field_order_is_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.field_order_request_save(uuid,jsonb,text,text,date,uuid), public.field_order_request_cancel(uuid), public.field_order_requests_list(date,date,uuid,uuid), public.field_order_mark_delivered(uuid), public.field_order_build_route(uuid[],date), public.field_order_is_owner(uuid) TO authenticated, service_role;