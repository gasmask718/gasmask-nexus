CREATE OR REPLACE FUNCTION public.field_route_stop_outcome(p_stop_id uuid,p_outcome text,p_lat double precision DEFAULT NULL,p_lng double precision DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.route_stops; r public.routes; n integer; lo date; hi date; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF p_outcome IS NULL OR p_outcome NOT IN ('completed','skipped','closed') THEN RAISE EXCEPTION 'Invalid stop outcome'; END IF;
 IF (p_lat IS NULL) <> (p_lng IS NULL) OR (p_lat IS NOT NULL AND (p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180)) THEN RAISE EXCEPTION 'Invalid GPS coordinates'; END IF;
 SELECT * INTO s FROM public.route_stops WHERE id=p_stop_id FOR UPDATE;
 SELECT * INTO r FROM public.routes WHERE id=s.route_id;
 IF r.id IS NULL OR r.status IN ('cancelled','canceled') OR NOT coalesce(r.assigned_to=auth.uid() OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Route access denied'; END IF;
 UPDATE public.route_stops SET status=p_outcome,completed_by=auth.uid(),completed_at=now(),actual_arrival=coalesce(actual_arrival,now()),completion_gps_lat=p_lat,completion_gps_lng=p_lng WHERE id=s.id;
 n:=1;
 IF p_outcome='completed' AND s.store_id IS NOT NULL THEN
 PERFORM public.bump_store_last_visit(s.store_id,now());
 IF r.name LIKE 'Ching MASTER -%' OR r.name LIKE 'Ching 50 Day %' THEN
 SELECT min(date),max(date) INTO lo,hi FROM public.routes WHERE assigned_to=r.assigned_to AND name LIKE 'Ching 50 Day %' AND status NOT IN ('cancelled','canceled') AND NOT coalesce(is_trial,false);
 UPDATE public.route_stops st SET status='completed',completed_by=auth.uid(),completed_at=now(),actual_arrival=coalesce(st.actual_arrival,now()),completion_gps_lat=p_lat,completion_gps_lng=p_lng FROM public.routes rr WHERE rr.id=st.route_id AND st.store_id=s.store_id AND st.id<>s.id AND rr.assigned_to=r.assigned_to AND rr.status NOT IN ('cancelled','canceled') AND rr.date BETWEEN lo AND hi AND (rr.name LIKE 'Ching MASTER -%' OR rr.name LIKE 'Ching 50 Day %') AND st.status NOT IN ('complete','completed','visited');
 GET DIAGNOSTICS n=ROW_COUNT; n:=n+1;
 END IF; END IF; RETURN n;
 END $$;