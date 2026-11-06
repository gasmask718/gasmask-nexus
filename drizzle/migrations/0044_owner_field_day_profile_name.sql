CREATE OR REPLACE FUNCTION public.owner_field_day(p_day date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE lo timestamptz := (p_day::timestamp AT TIME ZONE 'America/New_York'); hi timestamptz := ((p_day + 1)::timestamp AT TIME ZONE 'America/New_York'); v jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Owner only'; END IF;
  WITH ev AS (
    SELECT e.*, coalesce(a.name, p.name, 'Unknown') who FROM public.route_stop_events e
    LEFT JOIN public.ambassadors a ON a.id = e.ambassador_id LEFT JOIN public.profiles p ON p.id = e.user_id
    WHERE e.happened_at >= lo AND e.happened_at < hi),
  pings AS (
    SELECT user_id, lat, lng, lag(lat) OVER w plat, lag(lng) OVER w plng, lag(recorded_at) OVER w pat, recorded_at
    FROM public.ambassador_gps_pings WHERE recorded_at >= lo AND recorded_at < hi WINDOW w AS (PARTITION BY user_id ORDER BY recorded_at)),
  miles AS (
    SELECT user_id, sum(CASE WHEN plat IS NULL THEN 0 ELSE public._miles(plat, plng, lat, lng) END) mi, count(*) pts FROM pings
    WHERE plat IS NULL OR (public._miles(plat, plng, lat, lng) / greatest(extract(epoch FROM recorded_at - pat)/3600, 0.0003)) < 90
    GROUP BY user_id),
  people AS (SELECT DISTINCT user_id FROM ev UNION SELECT user_id FROM miles),
  summary AS (
    SELECT pe.user_id, coalesce((SELECT a.name FROM public.ambassadors a WHERE a.user_id = pe.user_id AND a.deleted_at IS NULL LIMIT 1), pr.name, 'Unknown') who,
      (SELECT count(DISTINCT e.route_stop_id) FROM ev e WHERE e.user_id = pe.user_id AND e.outcome NOT IN ('skipped','undo','note')) visited,
      (SELECT count(*) FROM ev e WHERE e.user_id = pe.user_id AND e.outcome = 'ordered') ordered_outcomes,
      (SELECT count(*) FROM public.delivery_requests d WHERE d.requested_by = pe.user_id AND d.created_at >= lo AND d.created_at < hi AND d.status <> 'cancelled') order_requests,
      (SELECT count(*) FROM public.store_master sm JOIN public.ambassadors a ON a.id = sm.confirmed_by_ambassador_id
         WHERE a.user_id = pe.user_id AND sm.confirmed_at >= lo AND sm.confirmed_at < hi) new_stores,
      round(coalesce(m.mi,0)::numeric, 1) miles, coalesce(m.pts,0) gps_points
    FROM people pe LEFT JOIN public.profiles pr ON pr.id = pe.user_id LEFT JOIN miles m ON m.user_id = pe.user_id)
  SELECT jsonb_build_object(
    'summary', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.visited DESC) FROM summary s), '[]'),
    'checkins', coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', e.user_id, 'who', e.who, 'lat', e.lat, 'lng', e.lng,
        'at', e.happened_at, 'outcome', e.outcome, 'store', sm.store_name) ORDER BY e.happened_at)
      FROM ev e LEFT JOIN public.store_master sm ON sm.id = e.store_id WHERE e.lat IS NOT NULL), '[]')) INTO v;
  RETURN v;
END $$;