ALTER TYPE public.territory_region_type ADD VALUE IF NOT EXISTS 'zip';

DROP FUNCTION IF EXISTS public.territory_matches_store(text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.territory_matches_store(
  _region_type text,
  _region_value text,
  _store_state text,
  _store_city text,
  _store_borough text,
  _store_neighborhood text,
  _store_zip text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_type text := lower(trim(coalesce(_region_type, '')));
  v_region text := lower(trim(coalesce(_region_value, '')));
  v_city text := lower(trim(coalesce(_store_city, '')));
  v_borough text := lower(trim(coalesce(_store_borough, '')));
  v_neighborhood text := lower(trim(coalesce(_store_neighborhood, '')));
  v_zip text := substring(regexp_replace(coalesce(_store_zip, ''), '[^0-9]', '', 'g') from 1 for 5);
  v_region_zip text := substring(regexp_replace(coalesce(_region_value, ''), '[^0-9]', '', 'g') from 1 for 5);
BEGIN
  IF v_type = 'state' THEN
    RETURN public.normalize_us_state(_region_value) = public.normalize_us_state(_store_state);
  ELSIF v_type = 'zip' THEN
    RETURN length(v_region_zip) = 5 AND length(v_zip) = 5 AND v_region_zip = v_zip;
  ELSIF v_type = 'city' THEN
    v_region := lower(trim(regexp_replace(coalesce(_region_value, ''), ',[[:space:]]*[A-Za-z ]+$', '')));
    RETURN v_region = v_city OR v_region = v_borough;
  ELSIF v_type = 'borough' THEN
    RETURN v_region = v_borough;
  ELSIF v_type = 'neighborhood' THEN
    RETURN v_region = v_neighborhood;
  ELSIF v_type = 'custom_zone' THEN
    RETURN v_region = v_city OR v_region = v_borough OR v_region = v_neighborhood;
  END IF;
  RETURN false;
END
$function$;

REVOKE EXECUTE ON FUNCTION public.territory_matches_store(text, text, text, text, text, text, text) FROM anon;

CREATE OR REPLACE FUNCTION public.ambassador_has_store_access(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND _store_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.ambassadors a
    JOIN public.store_master sm ON sm.id = _store_id
    WHERE a.user_id = _user_id
      AND a.is_active IS TRUE
      AND a.deleted_at IS NULL
      AND sm.deleted_at IS NULL
      AND coalesce(sm.is_simulation, false) IS FALSE
      AND (
        EXISTS (
          SELECT 1 FROM public.ambassador_territory_coverage tc
          WHERE tc.ambassador_id = a.id
            AND public.territory_matches_store(tc.region_type::text, tc.region_value, sm.state, sm.city, sm.borough, sm.neighborhood, sm.zip)
        )
        OR EXISTS (
          SELECT 1 FROM public.ambassador_assignments aa
          WHERE aa.ambassador_id = a.id AND aa.store_id = sm.id
            AND aa.active IS TRUE AND aa.unassigned_at IS NULL
        )
        OR sm.assigned_ambassador_id = a.id
        OR EXISTS (
          SELECT 1 FROM public.route_stops rs
          JOIN public.routes r ON r.id = rs.route_id
          WHERE rs.store_id = sm.id AND r.assigned_to = _user_id
            AND r.date >= CURRENT_DATE - INTERVAL '30 days'
        )
      )
  )
$function$;