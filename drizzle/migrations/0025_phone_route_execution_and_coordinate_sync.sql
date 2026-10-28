ALTER TABLE public.store_master ADD COLUMN IF NOT EXISTS geocode_confidence text, ADD COLUMN IF NOT EXISTS geocode_source text, ADD COLUMN IF NOT EXISTS geocoded_at timestamptz, ADD COLUMN IF NOT EXISTS geocode_attempted_at timestamptz;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS geocode_confidence text;
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS completed_by uuid, ADD COLUMN IF NOT EXISTS completed_at timestamptz, ADD COLUMN IF NOT EXISTS completion_gps_lat double precision, ADD COLUMN IF NOT EXISTS completion_gps_lng double precision;
CREATE OR REPLACE FUNCTION public.sync_store_coordinates_to_routes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.lat IS NOT NULL AND NEW.lon IS NOT NULL THEN
 UPDATE public.stores SET lat=NEW.lat,lng=NEW.lon,geocode_confidence=NEW.geocode_confidence WHERE id=NEW.id AND (lat IS DISTINCT FROM NEW.lat OR lng IS DISTINCT FROM NEW.lon OR geocode_confidence IS DISTINCT FROM NEW.geocode_confidence);
 UPDATE public.route_stops SET lat=NEW.lat,lng=NEW.lon WHERE store_id=NEW.id AND (lat IS NULL OR lng IS NULL);
 END IF; RETURN NEW; END $$;
CREATE TRIGGER sync_store_coordinates_to_routes AFTER INSERT OR UPDATE OF lat,lon,geocode_confidence ON public.store_master FOR EACH ROW EXECUTE FUNCTION public.sync_store_coordinates_to_routes();
CREATE OR REPLACE FUNCTION public.field_route_stop_outcome(p_stop_id uuid,p_outcome text,p_lat double precision DEFAULT NULL,p_lng double precision DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.route_stops; r public.routes; n integer; lo date; hi date; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF p_outcome NOT IN ('completed','skipped','closed') THEN RAISE EXCEPTION 'Invalid stop outcome'; END IF;
 IF (p_lat IS NULL) <> (p_lng IS NULL) OR (p_lat IS NOT NULL AND (p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180)) THEN RAISE EXCEPTION 'Invalid GPS coordinates'; END IF;
 SELECT * INTO s FROM public.route_stops WHERE id=p_stop_id FOR UPDATE;
 SELECT * INTO r FROM public.routes WHERE id=s.route_id;
 IF r.id IS NULL OR r.status IN ('cancelled','canceled') OR NOT (r.assigned_to=auth.uid() OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Route access denied'; END IF;
 UPDATE public.route_stops SET status=p_outcome,completed_by=auth.uid(),completed_at=now(),actual_arrival=coalesce(actual_arrival,now()),completion_gps_lat=p_lat,completion_gps_lng=p_lng WHERE id=s.id;
 n:=1;
 IF p_outcome='completed' AND s.store_id IS NOT NULL THEN
 PERFORM public.bump_store_last_visit(s.store_id,now());
 IF r.name LIKE 'Ching MASTER -%' OR r.name LIKE 'Ching 50 Day %' THEN
 SELECT min(date),max(date) INTO lo,hi FROM public.routes WHERE assigned_to=r.assigned_to AND name LIKE 'Ching 50 Day %' AND status NOT IN ('cancelled','canceled');
 UPDATE public.route_stops st SET status='completed',completed_by=auth.uid(),completed_at=now(),actual_arrival=coalesce(st.actual_arrival,now()),completion_gps_lat=p_lat,completion_gps_lng=p_lng FROM public.routes rr WHERE rr.id=st.route_id AND st.store_id=s.store_id AND st.id<>s.id AND rr.assigned_to=r.assigned_to AND rr.status NOT IN ('cancelled','canceled') AND rr.date BETWEEN lo AND hi AND (rr.name LIKE 'Ching MASTER -%' OR rr.name LIKE 'Ching 50 Day %') AND st.status NOT IN ('complete','completed','visited');
 GET DIAGNOSTICS n=ROW_COUNT; n:=n+1;
 END IF; END IF; RETURN n;
 END $$;
REVOKE ALL ON FUNCTION public.field_route_stop_outcome(uuid,text,double precision,double precision) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.field_route_stop_outcome(uuid,text,double precision,double precision) TO authenticated;
CREATE OR REPLACE FUNCTION public.apply_missing_store_geocode(p_id uuid,p_lat double precision,p_lon double precision,p_confidence text,p_source text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n integer; BEGIN
 IF NOT (coalesce(auth.role(),'')='service_role' OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Owner access required'; END IF;
 IF p_lat NOT BETWEEN -90 AND 90 OR p_lon NOT BETWEEN -180 AND 180 OR p_lat IS NULL OR p_lon IS NULL OR p_source NOT IN ('census','google') THEN RAISE EXCEPTION 'Invalid geocode'; END IF;
 UPDATE public.store_master SET lat=coalesce(lat,p_lat),lon=coalesce(lon,p_lon),geocode_confidence=p_confidence,geocode_source=p_source,geocoded_at=now(),geocode_attempted_at=now() WHERE id=p_id AND (lat IS NULL OR lon IS NULL) AND NOT coalesce(is_portal_test,false);
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n>0; END $$;
REVOKE ALL ON FUNCTION public.apply_missing_store_geocode(uuid,double precision,double precision,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_missing_store_geocode(uuid,double precision,double precision,text,text) TO authenticated,service_role;