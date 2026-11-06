ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS ambassador_id uuid,
  ADD COLUMN IF NOT EXISTS master_route_id uuid,
  ADD COLUMN IF NOT EXISTS service_minutes integer,
  ADD COLUMN IF NOT EXISTS return_to_start boolean;
CREATE INDEX IF NOT EXISTS routes_master_route_id_idx ON public.routes(master_route_id) WHERE master_route_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS routes_ambassador_id_idx ON public.routes(ambassador_id) WHERE ambassador_id IS NOT NULL;

ALTER TABLE public.route_stops
  ADD COLUMN IF NOT EXISTS master_stop_id uuid,
  ADD COLUMN IF NOT EXISTS window_start time,
  ADD COLUMN IF NOT EXISTS window_end time,
  ADD COLUMN IF NOT EXISTS window_label text,
  ADD COLUMN IF NOT EXISTS pinned text;
ALTER TABLE public.route_stops DROP CONSTRAINT IF EXISTS route_stops_pinned_check;
ALTER TABLE public.route_stops ADD CONSTRAINT route_stops_pinned_check CHECK (pinned IS NULL OR pinned IN ('first','last'));
CREATE INDEX IF NOT EXISTS route_stops_master_stop_id_idx ON public.route_stops(master_stop_id) WHERE master_stop_id IS NOT NULL;

-- Backfill: which ambassador each master list belongs to (from the 11/6 build).
UPDATE public.routes r SET ambassador_id = m.amb FROM (VALUES
 ('b3adf09c-4910-4523-ab5b-70b9a4885f27'::uuid,'60786833-534a-4e33-8b63-6e6cd2107b72'::uuid),
 ('756fac42-ebbf-43b3-bd36-2015dc72b671','4384d4d8-efd4-425c-959d-25574a809868'),
 ('8d841b80-3804-42c2-a07e-3a58ae7aae8a','860650de-14b9-4ff8-8d78-f26ecea076db'),
 ('43fd70eb-8043-45c1-b8f7-40666f2f66dd','6c14a2e4-c7f8-4242-aa36-d95d9708c9ac'),
 ('477a77b8-fa6d-423b-a0de-e9c95e5620e7','86a4dd61-8034-4d52-afdf-cbfd1cc9c6d1'),
 ('8bfb8bf9-98fb-405e-9206-b9b569de83fa','2148a425-1dd9-4c76-9752-74e8fa62cfe3'),
 ('9b669f57-f71f-4687-a1d2-919d389e546d','c45df482-2cf2-4534-89ab-2f335f827b33'),
 ('d6fa7482-c462-49ae-a7b8-b6011411513b','aad2dc27-d8d7-488a-95af-e4304d902e05'),
 ('5f421567-806f-4bf1-97b6-84568cacda35','dd3db7d1-48ff-45c0-98b9-55b74a3c0337'),
 ('0a6ae3ec-7f0b-4bab-af39-224db13b9fb6','c14f34ac-cb8d-448f-82e9-f3448ca6c62c'),
 ('8c2e4d21-5475-48fb-ba54-0487a1d6788d','a676c111-a372-4f79-898b-98893badaaf2'),
 ('7b042b59-95eb-484a-a6db-0634fec2ffef','5e053274-e17c-4c7a-8241-f6057529cb8d'),
 ('e9283252-11c1-49c6-ad49-860fb29ba8df','300c713b-bc44-429f-b8e4-b87b48f0cc8e'),
 ('0d12154d-f1b7-4325-b13a-dd7ae2c2c77d','47fd69ca-4018-4f6e-acd5-c4af8f726ea6'),
 ('35fd46bf-e495-462b-856d-8966f4f473e6','75c71234-c4c3-4a1a-8352-d917c782dbf4'),
 ('40f1d3b0-4135-4888-bf30-735d55e83175','a88fccad-77f2-4e19-a348-5e2b457030f6')
) m(rid, amb) WHERE r.id = m.rid AND r.ambassador_id IS NULL;

-- Every route-stop action (check-in, outcome, skip, undo). client_id makes offline replays idempotent.
CREATE TABLE IF NOT EXISTS public.route_stop_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  route_stop_id uuid NOT NULL,
  route_id uuid NOT NULL,
  store_id uuid,
  user_id uuid NOT NULL,
  ambassador_id uuid,
  outcome text NOT NULL CHECK (outcome IN ('checkin','ordered','follow_up','not_interested','no_tobacco','closed','boss_not_in','skipped','undo','note')),
  follow_up_date date,
  note text,
  lat double precision,
  lng double precision,
  photo_path text,
  happened_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS route_stop_events_client_id_key ON public.route_stop_events(client_id);
CREATE INDEX IF NOT EXISTS route_stop_events_day_idx ON public.route_stop_events(happened_at);
CREATE INDEX IF NOT EXISTS route_stop_events_stop_idx ON public.route_stop_events(route_stop_id);
GRANT SELECT ON public.route_stop_events TO authenticated;
GRANT ALL ON public.route_stop_events TO service_role;
ALTER TABLE public.route_stop_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY route_stop_events_select ON public.route_stop_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.ambassador_gps_pings (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  ambassador_id uuid,
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  accuracy_m real,
  recorded_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ambassador_gps_pings_user_time_key ON public.ambassador_gps_pings(user_id, recorded_at);
CREATE INDEX IF NOT EXISTS ambassador_gps_pings_time_idx ON public.ambassador_gps_pings(recorded_at);
GRANT SELECT ON public.ambassador_gps_pings TO authenticated;
GRANT ALL ON public.ambassador_gps_pings TO service_role;
ALTER TABLE public.ambassador_gps_pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY ambassador_gps_pings_select ON public.ambassador_gps_pings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public._route_can_work(p_route_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.routes r WHERE r.id = p_route_id
    AND coalesce(r.status,'') NOT IN ('cancelled','canceled')
    AND (r.assigned_to = auth.uid() OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')
         OR (r.ambassador_id IS NOT NULL AND r.ambassador_id = (SELECT a.id FROM public.ambassadors a WHERE a.user_id = auth.uid() AND a.deleted_at IS NULL LIMIT 1))))
$$;
REVOKE EXECUTE ON FUNCTION public._route_can_work(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.route_master_list()
RETURNS TABLE(route_id uuid, name text, territory text, stops bigint, ambassador_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.id, r.name, r.territory, (SELECT count(*) FROM public.route_stops s WHERE s.route_id = r.id), a.name
  FROM public.routes r LEFT JOIN public.ambassadors a ON a.id = r.ambassador_id
  WHERE r.name LIKE '% - ALL MY STORES%' AND coalesce(r.status,'') NOT IN ('cancelled','canceled')
    AND public._route_can_work(r.id)
  ORDER BY (r.assigned_to = auth.uid()) DESC NULLS LAST, r.name
$$;
GRANT EXECUTE ON FUNCTION public.route_master_list() TO authenticated;

-- Slim master-list rows. Shared stores locked to another ambassador drop out.
CREATE OR REPLACE FUNCTION public.route_master_stops(p_route_id uuid, p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000)
RETURNS TABLE(stop_id uuid, store_id uuid, store_name text, address text, zip text, area text, phone text,
  stop_reason text, notes_to_worker text, status text, lat double precision, lng double precision,
  relationship_status text, last_visit_at timestamptz, shared boolean, completed_at timestamptz, planned_order integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_amb uuid;
BEGIN
  IF NOT public._route_can_work(p_route_id) THEN RAISE EXCEPTION 'Route access denied'; END IF;
  SELECT ambassador_id INTO v_amb FROM public.routes WHERE id = p_route_id;
  RETURN QUERY
  SELECT s.id, s.store_id, coalesce(sm.store_name, st.name), coalesce(s.address, sm.address), coalesce(s.zip, sm.zip), s.area,
    coalesce(sm.phone, st.phone), s.stop_reason, s.notes_to_worker, s.status,
    coalesce(s.lat::double precision, sm.lat::double precision), coalesce(s.lng::double precision, sm.lon::double precision),
    sm.relationship_status, sm.last_visit_at, coalesce(s.notes_to_worker,'') LIKE 'SHARED%', s.completed_at, s.planned_order
  FROM public.route_stops s
  LEFT JOIN public.store_master sm ON sm.id = s.store_id
  LEFT JOIN public.stores st ON st.id = s.store_id
  WHERE s.route_id = p_route_id
    AND NOT (coalesce(s.notes_to_worker,'') LIKE 'SHARED%' AND v_amb IS NOT NULL
             AND sm.confirmed_by_ambassador_id IS NOT NULL AND sm.confirmed_by_ambassador_id <> v_amb)
  ORDER BY s.planned_order, s.id
  OFFSET greatest(p_offset,0) LIMIT least(greatest(p_limit,1),1000);
END $$;
GRANT EXECUTE ON FUNCTION public.route_master_stops(uuid, integer, integer) TO authenticated;

-- Save an optimized day route built from a master list.
CREATE OR REPLACE FUNCTION public.route_build_day(
  p_master_route_id uuid, p_date date, p_name text, p_stops jsonb,
  p_start_address text DEFAULT NULL, p_start_lat double precision DEFAULT NULL, p_start_lng double precision DEFAULT NULL,
  p_return_to_start boolean DEFAULT false, p_service_minutes integer DEFAULT 10,
  p_miles numeric DEFAULT NULL, p_minutes integer DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m public.routes; v_id uuid; v_item jsonb; v_i int := 0; s public.route_stops;
BEGIN
  IF NOT public._route_can_work(p_master_route_id) THEN RAISE EXCEPTION 'Route access denied'; END IF;
  SELECT * INTO m FROM public.routes WHERE id = p_master_route_id;
  IF jsonb_typeof(p_stops) <> 'array' OR jsonb_array_length(p_stops) = 0 OR jsonb_array_length(p_stops) > 150 THEN
    RAISE EXCEPTION 'Pick between 1 and 150 stops';
  END IF;
  IF p_date IS NULL OR p_date < (now() AT TIME ZONE 'America/New_York')::date - 1 OR p_date > (now() AT TIME ZONE 'America/New_York')::date + 60 THEN
    RAISE EXCEPTION 'Pick a date within the next 60 days';
  END IF;
  INSERT INTO public.routes (date, type, name, assigned_to, ambassador_id, master_route_id, territory, status, source, created_by,
    start_address, start_lat, start_lng, return_to_start, service_minutes, estimated_distance_km, estimated_duration_minutes,
    is_optimized, optimized_at, notes)
  VALUES (p_date, 'ambassador', left(coalesce(nullif(btrim(p_name),''), split_part(m.name,' - ',1) || ' - ' || to_char(p_date,'Mon DD')),200),
    m.assigned_to, m.ambassador_id, m.id, m.territory, 'active', 'manual', auth.uid(),
    nullif(btrim(p_start_address),''), p_start_lat, p_start_lng, coalesce(p_return_to_start,false), greatest(coalesce(p_service_minutes,10),0),
    CASE WHEN p_miles IS NOT NULL THEN round(p_miles * 1.60934, 2) END, p_minutes, true, now(),
    'Day route built from ' || m.name)
  RETURNING id INTO v_id;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_stops) LOOP
    v_i := v_i + 1;
    SELECT * INTO s FROM public.route_stops WHERE id = (v_item->>'stop_id')::uuid AND route_id = m.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'A picked stop is not on this master list'; END IF;
    INSERT INTO public.route_stops (route_id, store_id, planned_order, notes_to_worker, status, stop_reason, address, zip, area, lat, lng,
      master_stop_id, window_start, window_end, window_label, pinned, brand_id)
    VALUES (v_id, s.store_id, v_i, s.notes_to_worker, 'pending', coalesce(nullif(s.stop_reason,''),'prospect'), s.address, s.zip, s.area,
      coalesce(s.lat, (SELECT sm.lat FROM public.store_master sm WHERE sm.id = s.store_id)),
      coalesce(s.lng, (SELECT sm.lon FROM public.store_master sm WHERE sm.id = s.store_id)),
      s.id, nullif(v_item->>'window_start','')::time, nullif(v_item->>'window_end','')::time,
      left(nullif(v_item->>'window_label',''),80), nullif(v_item->>'pinned',''), s.brand_id);
  END LOOP;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.route_build_day(uuid, date, text, jsonb, text, double precision, double precision, boolean, integer, numeric, integer) TO authenticated;

-- Save a re-ordered sequence (drag / re-optimize mid-day).
CREATE OR REPLACE FUNCTION public.route_save_order(p_route_id uuid, p_stop_ids uuid[], p_miles numeric DEFAULT NULL, p_minutes integer DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int;
BEGIN
  IF NOT public._route_can_work(p_route_id) THEN RAISE EXCEPTION 'Route access denied'; END IF;
  IF (SELECT name FROM public.routes WHERE id = p_route_id) LIKE '% - ALL MY STORES%' THEN RAISE EXCEPTION 'The master list order is not changed'; END IF;
  UPDATE public.route_stops s SET planned_order = o.ord FROM unnest(p_stop_ids) WITH ORDINALITY o(id, ord)
   WHERE s.id = o.id AND s.route_id = p_route_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.routes SET optimized_at = now(), is_optimized = true,
    estimated_distance_km = coalesce(round(p_miles * 1.60934, 2), estimated_distance_km),
    estimated_duration_minutes = coalesce(p_minutes, estimated_duration_minutes)
   WHERE id = p_route_id;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.route_save_order(uuid, uuid[], numeric, integer) TO authenticated;

-- One stop action. Idempotent by client id so offline queues can replay safely.
CREATE OR REPLACE FUNCTION public.route_stop_action(
  p_client_id uuid, p_stop_id uuid, p_outcome text, p_note text DEFAULT NULL, p_follow_up date DEFAULT NULL,
  p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL, p_photo_path text DEFAULT NULL,
  p_happened_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.route_stops; r public.routes; v_amb uuid; v_rel text; v_status text; v_label text; v_locked boolean := false;
        v_at timestamptz := least(coalesce(p_happened_at, now()), now()); v_text text; v_ids uuid[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF EXISTS (SELECT 1 FROM public.route_stop_events WHERE client_id = p_client_id) THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true);
  END IF;
  IF p_outcome NOT IN ('checkin','ordered','follow_up','not_interested','no_tobacco','closed','boss_not_in','skipped','undo','note') THEN
    RAISE EXCEPTION 'Unknown outcome';
  END IF;
  IF (p_lat IS NULL) <> (p_lng IS NULL) OR (p_lat IS NOT NULL AND (p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180)) THEN
    RAISE EXCEPTION 'Invalid GPS';
  END IF;
  SELECT * INTO s FROM public.route_stops WHERE id = p_stop_id FOR UPDATE;
  IF NOT FOUND OR NOT public._route_can_work(s.route_id) THEN RAISE EXCEPTION 'Route access denied'; END IF;
  SELECT * INTO r FROM public.routes WHERE id = s.route_id;
  SELECT id INTO v_amb FROM public.ambassadors WHERE user_id = auth.uid() AND deleted_at IS NULL LIMIT 1;
  v_ids := ARRAY[s.id] || CASE WHEN s.master_stop_id IS NOT NULL THEN ARRAY[s.master_stop_id] ELSE '{}'::uuid[] END;

  IF p_outcome = 'undo' THEN
    UPDATE public.route_stops SET status = 'pending', completed_by = NULL, completed_at = NULL
     WHERE id = ANY(v_ids) AND status IN ('completed','skipped');
  ELSIF p_outcome = 'skipped' THEN
    UPDATE public.route_stops SET status = 'skipped', completed_by = auth.uid(), completed_at = v_at WHERE id = s.id;
  ELSIF p_outcome IN ('checkin','note') THEN
    UPDATE public.route_stops SET actual_arrival = coalesce(actual_arrival, v_at),
      completion_gps_lat = coalesce(p_lat, completion_gps_lat), completion_gps_lng = coalesce(p_lng, completion_gps_lng)
     WHERE id = s.id;
  ELSE
    UPDATE public.route_stops SET status = 'completed', completed_by = auth.uid(), completed_at = v_at,
      actual_arrival = coalesce(actual_arrival, v_at),
      completion_gps_lat = coalesce(p_lat, completion_gps_lat), completion_gps_lng = coalesce(p_lng, completion_gps_lng)
     WHERE id = ANY(v_ids);
  END IF;

  v_rel := CASE p_outcome WHEN 'ordered' THEN 'Active (Good)' WHEN 'follow_up' THEN 'Follow-up (secure relationship)'
    WHEN 'not_interested' THEN 'Not interested' WHEN 'no_tobacco' THEN 'No tobacco' WHEN 'closed' THEN 'Closed permanently' END;
  v_label := CASE p_outcome WHEN 'checkin' THEN 'Checked in' WHEN 'ordered' THEN 'Ordered' WHEN 'follow_up' THEN 'Follow-up'
    WHEN 'not_interested' THEN 'Not interested' WHEN 'no_tobacco' THEN 'No tobacco' WHEN 'closed' THEN 'Closed'
    WHEN 'boss_not_in' THEN 'Boss not in' WHEN 'skipped' THEN 'Skipped' WHEN 'undo' THEN 'Undid last result' ELSE 'Note' END;

  IF s.store_id IS NOT NULL AND p_outcome NOT IN ('skipped','undo') THEN
    IF v_rel IS NOT NULL THEN
      UPDATE public.store_master SET relationship_status = v_rel WHERE id = s.store_id AND relationship_status IS DISTINCT FROM v_rel;
    END IF;
    v_text := 'Route visit (' || coalesce(r.name,'route') || '): ' || v_label
      || CASE WHEN p_follow_up IS NOT NULL THEN '. Come back ' || to_char(p_follow_up,'Mon DD') ELSE '' END
      || CASE WHEN nullif(btrim(p_note),'') IS NOT NULL THEN '. ' || left(btrim(p_note), 1000) ELSE '' END
      || CASE WHEN p_lat IS NOT NULL THEN ' [GPS ' || round(p_lat::numeric,5) || ',' || round(p_lng::numeric,5) || ']' ELSE '' END;
    INSERT INTO public.store_notes (store_id, note_text, created_by, note_date, source)
    VALUES (s.store_id, v_text, auth.uid(), (v_at AT TIME ZONE 'America/New_York')::date, 'route_visit');
    PERFORM public.bump_store_last_visit(s.store_id, v_at);
    -- First ambassador to record an order secures the store; Ching's inventory-check stops never move.
    IF p_outcome = 'ordered' AND v_amb IS NOT NULL AND coalesce(s.stop_reason,'') <> 'inventory_check'
       AND NOT public.has_role(auth.uid(),'owner') THEN
      UPDATE public.store_master SET confirmed_by_ambassador_id = v_amb, confirmed_at = now(), assigned_ambassador_id = v_amb
       WHERE id = s.store_id AND confirmed_by_ambassador_id IS NULL;
      v_locked := FOUND;
    END IF;
  END IF;

  INSERT INTO public.route_stop_events (client_id, route_stop_id, route_id, store_id, user_id, ambassador_id, outcome,
    follow_up_date, note, lat, lng, photo_path, happened_at)
  VALUES (p_client_id, s.id, s.route_id, s.store_id, auth.uid(), v_amb, p_outcome, p_follow_up, left(p_note,1000),
    p_lat, p_lng, nullif(p_photo_path,''), v_at);
  RETURN jsonb_build_object('success', true, 'locked_to_you', v_locked);
END $$;
GRANT EXECUTE ON FUNCTION public.route_stop_action(uuid, uuid, text, text, date, double precision, double precision, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.route_log_gps(p_points jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int; v_amb uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF jsonb_typeof(p_points) <> 'array' OR jsonb_array_length(p_points) > 500 THEN RAISE EXCEPTION 'Up to 500 points'; END IF;
  SELECT id INTO v_amb FROM public.ambassadors WHERE user_id = auth.uid() AND deleted_at IS NULL LIMIT 1;
  INSERT INTO public.ambassador_gps_pings (user_id, ambassador_id, lat, lng, accuracy_m, recorded_at)
  SELECT auth.uid(), v_amb, (p->>'lat')::float8, (p->>'lng')::float8, nullif(p->>'accuracy','')::real,
         least((p->>'at')::timestamptz, now())
  FROM jsonb_array_elements(p_points) p
  WHERE (p->>'lat')::float8 BETWEEN -90 AND 90 AND (p->>'lng')::float8 BETWEEN -180 AND 180
    AND (p->>'at')::timestamptz > now() - interval '3 days'
  ON CONFLICT (user_id, recorded_at) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.route_log_gps(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public._miles(a_lat float8, a_lng float8, b_lat float8, b_lng float8)
RETURNS float8 LANGUAGE sql IMMUTABLE AS $$
  SELECT 3958.7613 * 2 * asin(sqrt(power(sin(radians(b_lat - a_lat)/2),2) + cos(radians(a_lat))*cos(radians(b_lat))*power(sin(radians(b_lng - a_lng)/2),2)))
$$;

-- Owner (Ching) day view: per-ambassador summary + check-in points.
CREATE OR REPLACE FUNCTION public.owner_field_day(p_day date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE lo timestamptz := (p_day::timestamp AT TIME ZONE 'America/New_York'); hi timestamptz := ((p_day + 1)::timestamp AT TIME ZONE 'America/New_York'); v jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Owner only'; END IF;
  WITH ev AS (
    SELECT e.*, coalesce(a.name, p.full_name, 'Unknown') who FROM public.route_stop_events e
    LEFT JOIN public.ambassadors a ON a.id = e.ambassador_id LEFT JOIN public.profiles p ON p.id = e.user_id
    WHERE e.happened_at >= lo AND e.happened_at < hi),
  pings AS (
    SELECT user_id, lat, lng, lag(lat) OVER w plat, lag(lng) OVER w plng, lag(recorded_at) OVER w pat, recorded_at
    FROM public.ambassador_gps_pings WHERE recorded_at >= lo AND recorded_at < hi WINDOW w AS (PARTITION BY user_id ORDER BY recorded_at)),
  miles AS (
    SELECT user_id, sum(public._miles(plat, plng, lat, lng)) mi, count(*) pts FROM pings
    WHERE plat IS NULL OR (public._miles(plat, plng, lat, lng) / greatest(extract(epoch FROM recorded_at - pat)/3600, 0.0003)) < 90
    GROUP BY user_id),
  people AS (SELECT DISTINCT user_id FROM ev UNION SELECT user_id FROM miles),
  summary AS (
    SELECT pe.user_id, coalesce(a.name, pr.full_name, 'Unknown') who,
      (SELECT count(DISTINCT e.route_stop_id) FROM ev e WHERE e.user_id = pe.user_id AND e.outcome NOT IN ('skipped','undo','note')) visited,
      (SELECT count(*) FROM ev e WHERE e.user_id = pe.user_id AND e.outcome = 'ordered') ordered_outcomes,
      (SELECT count(*) FROM public.delivery_requests d WHERE d.requested_by = pe.user_id AND d.created_at >= lo AND d.created_at < hi AND d.status <> 'cancelled') order_requests,
      (SELECT count(*) FROM public.store_master sm WHERE sm.confirmed_by_ambassador_id = a.id AND sm.confirmed_at >= lo AND sm.confirmed_at < hi) new_stores,
      round(coalesce(m.mi,0)::numeric, 1) miles, coalesce(m.pts,0) gps_points
    FROM people pe LEFT JOIN public.ambassadors a ON a.user_id = pe.user_id AND a.deleted_at IS NULL
    LEFT JOIN public.profiles pr ON pr.id = pe.user_id LEFT JOIN miles m ON m.user_id = pe.user_id)
  SELECT jsonb_build_object(
    'summary', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.visited DESC) FROM summary s), '[]'),
    'checkins', coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', e.user_id, 'who', e.who, 'lat', e.lat, 'lng', e.lng,
        'at', e.happened_at, 'outcome', e.outcome, 'store', sm.store_name) ORDER BY e.happened_at)
      FROM ev e LEFT JOIN public.store_master sm ON sm.id = e.store_id WHERE e.lat IS NOT NULL), '[]')) INTO v;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.owner_field_day(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_gps_trail(p_user_id uuid, p_day date)
RETURNS TABLE(lat float8, lng float8, accuracy_m real, recorded_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT g.lat, g.lng, g.accuracy_m, g.recorded_at FROM public.ambassador_gps_pings g
  WHERE (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'))
    AND g.user_id = p_user_id
    AND g.recorded_at >= (p_day::timestamp AT TIME ZONE 'America/New_York') AND g.recorded_at < ((p_day + 1)::timestamp AT TIME ZONE 'America/New_York')
  ORDER BY g.recorded_at LIMIT 5000
$$;
GRANT EXECUTE ON FUNCTION public.owner_gps_trail(uuid, date) TO authenticated;

-- Coverage = stores on each master list seen in the last 30 days ÷ all stores on it, per area.
CREATE OR REPLACE FUNCTION public.owner_area_coverage()
RETURNS TABLE(route_id uuid, route_name text, area text, total bigint, visited_30d bigint, needs_gps bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.id, r.name, coalesce(nullif(s.area,''),'(no area)'), count(*),
    count(*) FILTER (WHERE sm.last_visit_at >= now() - interval '30 days'),
    count(*) FILTER (WHERE coalesce(s.lat::float8, sm.lat::float8) IS NULL)
  FROM public.routes r JOIN public.route_stops s ON s.route_id = r.id LEFT JOIN public.store_master sm ON sm.id = s.store_id
  WHERE (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'))
    AND r.name LIKE '% - ALL MY STORES%' AND coalesce(r.status,'') NOT IN ('cancelled','canceled')
  GROUP BY 1,2,3 ORDER BY 2,3
$$;
GRANT EXECUTE ON FUNCTION public.owner_area_coverage() TO authenticated;

-- Geocoder bookkeeping (service role only): mark attempted so the backfill moves forward.
CREATE OR REPLACE FUNCTION public.mark_store_geocode_attempted(p_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int;
BEGIN
  IF NOT (coalesce(auth.role(),'') = 'service_role' OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Owner access required'; END IF;
  UPDATE public.store_master SET geocode_attempted_at = now() WHERE id = ANY(p_ids) AND (lat IS NULL OR lon IS NULL);
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_store_geocode_attempted(uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_store_geocode_attempted(uuid[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.route_master_list() FROM anon;
REVOKE EXECUTE ON FUNCTION public.route_master_stops(uuid, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.route_build_day(uuid, date, text, jsonb, text, double precision, double precision, boolean, integer, numeric, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.route_save_order(uuid, uuid[], numeric, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.route_stop_action(uuid, uuid, text, text, date, double precision, double precision, text, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.route_log_gps(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.owner_field_day(date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.owner_gps_trail(uuid, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.owner_area_coverage() FROM anon;