CREATE TABLE public.ambassador_store_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.store_master(id),
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id),
  secured_at timestamptz NOT NULL DEFAULT now(),
  secured_by_user_id uuid NOT NULL,
  released_at timestamptz,
  released_by_user_id uuid,
  release_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ambassador_store_claim_release_consistency CHECK (
    (released_at IS NULL AND released_by_user_id IS NULL)
    OR (released_at IS NOT NULL AND released_by_user_id IS NOT NULL)
  )
);

GRANT SELECT ON public.ambassador_store_claims TO authenticated;
GRANT ALL ON public.ambassador_store_claims TO service_role;

ALTER TABLE public.ambassador_store_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view store claim status"
ON public.ambassador_store_claims
FOR SELECT
TO authenticated
USING (true);

CREATE UNIQUE INDEX ambassador_store_claims_one_active_per_store
ON public.ambassador_store_claims(store_id)
WHERE released_at IS NULL;

CREATE INDEX ambassador_store_claims_active_ambassador
ON public.ambassador_store_claims(ambassador_id, store_id)
WHERE released_at IS NULL;

CREATE OR REPLACE FUNCTION public.normalize_us_state(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE upper(trim(coalesce(_value, '')))
    WHEN 'ALABAMA' THEN 'AL' WHEN 'AL' THEN 'AL'
    WHEN 'ALASKA' THEN 'AK' WHEN 'AK' THEN 'AK'
    WHEN 'ARIZONA' THEN 'AZ' WHEN 'AZ' THEN 'AZ'
    WHEN 'ARKANSAS' THEN 'AR' WHEN 'AR' THEN 'AR'
    WHEN 'CALIFORNIA' THEN 'CA' WHEN 'CA' THEN 'CA'
    WHEN 'COLORADO' THEN 'CO' WHEN 'CO' THEN 'CO'
    WHEN 'CONNECTICUT' THEN 'CT' WHEN 'CT' THEN 'CT'
    WHEN 'DELAWARE' THEN 'DE' WHEN 'DE' THEN 'DE'
    WHEN 'FLORIDA' THEN 'FL' WHEN 'FL' THEN 'FL'
    WHEN 'GEORGIA' THEN 'GA' WHEN 'GA' THEN 'GA'
    WHEN 'HAWAII' THEN 'HI' WHEN 'HI' THEN 'HI'
    WHEN 'IDAHO' THEN 'ID' WHEN 'ID' THEN 'ID'
    WHEN 'ILLINOIS' THEN 'IL' WHEN 'IL' THEN 'IL'
    WHEN 'INDIANA' THEN 'IN' WHEN 'IN' THEN 'IN'
    WHEN 'IOWA' THEN 'IA' WHEN 'IA' THEN 'IA'
    WHEN 'KANSAS' THEN 'KS' WHEN 'KS' THEN 'KS'
    WHEN 'KENTUCKY' THEN 'KY' WHEN 'KY' THEN 'KY'
    WHEN 'LOUISIANA' THEN 'LA' WHEN 'LA' THEN 'LA'
    WHEN 'MAINE' THEN 'ME' WHEN 'ME' THEN 'ME'
    WHEN 'MARYLAND' THEN 'MD' WHEN 'MD' THEN 'MD'
    WHEN 'MASSACHUSETTS' THEN 'MA' WHEN 'MA' THEN 'MA'
    WHEN 'MICHIGAN' THEN 'MI' WHEN 'MI' THEN 'MI'
    WHEN 'MINNESOTA' THEN 'MN' WHEN 'MN' THEN 'MN'
    WHEN 'MISSISSIPPI' THEN 'MS' WHEN 'MS' THEN 'MS'
    WHEN 'MISSOURI' THEN 'MO' WHEN 'MO' THEN 'MO'
    WHEN 'MONTANA' THEN 'MT' WHEN 'MT' THEN 'MT'
    WHEN 'NEBRASKA' THEN 'NE' WHEN 'NE' THEN 'NE'
    WHEN 'NEVADA' THEN 'NV' WHEN 'NV' THEN 'NV'
    WHEN 'NEW HAMPSHIRE' THEN 'NH' WHEN 'NH' THEN 'NH'
    WHEN 'NEW JERSEY' THEN 'NJ' WHEN 'NJ' THEN 'NJ'
    WHEN 'NEW MEXICO' THEN 'NM' WHEN 'NM' THEN 'NM'
    WHEN 'NEW YORK' THEN 'NY' WHEN 'NY' THEN 'NY'
    WHEN 'NORTH CAROLINA' THEN 'NC' WHEN 'NC' THEN 'NC'
    WHEN 'NORTH DAKOTA' THEN 'ND' WHEN 'ND' THEN 'ND'
    WHEN 'OHIO' THEN 'OH' WHEN 'OH' THEN 'OH'
    WHEN 'OKLAHOMA' THEN 'OK' WHEN 'OK' THEN 'OK'
    WHEN 'OREGON' THEN 'OR' WHEN 'OR' THEN 'OR'
    WHEN 'PENNSYLVANIA' THEN 'PA' WHEN 'PA' THEN 'PA'
    WHEN 'RHODE ISLAND' THEN 'RI' WHEN 'RI' THEN 'RI'
    WHEN 'SOUTH CAROLINA' THEN 'SC' WHEN 'SC' THEN 'SC'
    WHEN 'SOUTH DAKOTA' THEN 'SD' WHEN 'SD' THEN 'SD'
    WHEN 'TENNESSEE' THEN 'TN' WHEN 'TN' THEN 'TN'
    WHEN 'TEXAS' THEN 'TX' WHEN 'TX' THEN 'TX'
    WHEN 'UTAH' THEN 'UT' WHEN 'UT' THEN 'UT'
    WHEN 'VERMONT' THEN 'VT' WHEN 'VT' THEN 'VT'
    WHEN 'VIRGINIA' THEN 'VA' WHEN 'VA' THEN 'VA'
    WHEN 'WASHINGTON' THEN 'WA' WHEN 'WA' THEN 'WA'
    WHEN 'WEST VIRGINIA' THEN 'WV' WHEN 'WV' THEN 'WV'
    WHEN 'WISCONSIN' THEN 'WI' WHEN 'WI' THEN 'WI'
    WHEN 'WYOMING' THEN 'WY' WHEN 'WY' THEN 'WY'
    ELSE upper(trim(coalesce(_value, '')))
  END
$$;

CREATE OR REPLACE FUNCTION public.territory_matches_store(
  _region_type text,
  _region_value text,
  _store_state text,
  _store_city text,
  _store_borough text,
  _store_neighborhood text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_type text := lower(trim(coalesce(_region_type, '')));
  v_region text := lower(trim(coalesce(_region_value, '')));
  v_city text := lower(trim(coalesce(_store_city, '')));
  v_borough text := lower(trim(coalesce(_store_borough, '')));
  v_neighborhood text := lower(trim(coalesce(_store_neighborhood, '')));
BEGIN
  IF v_type = 'state' THEN
    RETURN public.normalize_us_state(_region_value) = public.normalize_us_state(_store_state);
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
$$;

CREATE OR REPLACE FUNCTION public.ambassador_has_store_access(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
            AND public.territory_matches_store(tc.region_type::text, tc.region_value, sm.state, sm.city, sm.borough, sm.neighborhood)
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
$$;

CREATE OR REPLACE FUNCTION public.ambassador_visible_store_ids_for_user(_user_id uuid)
RETURNS TABLE(store_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sm.id
  FROM public.store_master sm
  WHERE public.ambassador_has_store_access(_user_id, sm.id)
$$;

CREATE OR REPLACE FUNCTION public.my_field_store_ids()
RETURNS TABLE(store_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.store_id FROM public.ambassador_visible_store_ids_for_user(auth.uid()) v
  UNION
  SELECT da.store_id
  FROM public.driver_assignments da
  WHERE da.is_active IS TRUE AND da.store_id IS NOT NULL
    AND (da.driver_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = da.driver_id AND d.user_id = auth.uid()))
  UNION
  SELECT rs.store_id
  FROM public.route_stops rs
  JOIN public.routes r ON r.id = rs.route_id
  WHERE r.assigned_to = auth.uid()
    AND r.date >= CURRENT_DATE - INTERVAL '30 days'
    AND rs.store_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.field_worker_has_store(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ambassador_has_store_access(_user_id, _store_id)
    OR EXISTS (
      SELECT 1 FROM public.driver_assignments da
      WHERE da.store_id = _store_id AND da.is_active IS TRUE
        AND (da.driver_id = _user_id
          OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = da.driver_id AND d.user_id = _user_id))
    )
    OR EXISTS (
      SELECT 1 FROM public.route_stops rs
      JOIN public.routes r ON r.id = rs.route_id
      WHERE rs.store_id = _store_id AND r.assigned_to = _user_id
        AND r.date >= CURRENT_DATE - INTERVAL '30 days'
    )
$$;

CREATE OR REPLACE FUNCTION public.ambassador_visible_stores()
RETURNS TABLE (
  store_id uuid,
  store_name text,
  store_address text,
  store_city text,
  store_state text,
  store_phone text,
  store_owner text,
  latitude numeric,
  longitude numeric,
  access_source text,
  assignment_id uuid,
  assignment_type text,
  is_primary boolean,
  commission_rate numeric,
  assigned_at timestamptz,
  secured_ambassador_id uuid,
  secured_ambassador_name text,
  secured_at timestamptz,
  secured_by_me boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT a.id
    FROM public.ambassadors a
    WHERE a.user_id = auth.uid() AND a.is_active IS TRUE AND a.deleted_at IS NULL
    ORDER BY a.created_at DESC LIMIT 1
  ), visible AS (
    SELECT sm.*
    FROM public.store_master sm
    WHERE public.ambassador_has_store_access(auth.uid(), sm.id)
  )
  SELECT
    sm.id,
    sm.store_name,
    sm.address,
    sm.city,
    sm.state,
    sm.phone,
    sm.owner_name,
    s.lat,
    s.lng,
    CASE WHEN aa.id IS NOT NULL THEN 'direct_assignment'
         WHEN sm.assigned_ambassador_id = me.id THEN 'legacy_assignment'
         WHEN EXISTS (
           SELECT 1 FROM public.route_stops rs JOIN public.routes r ON r.id = rs.route_id
           WHERE rs.store_id = sm.id AND r.assigned_to = auth.uid()
             AND r.date >= CURRENT_DATE - INTERVAL '30 days'
         ) THEN 'route'
         ELSE 'territory' END,
    aa.id,
    coalesce(aa.assignment_role, aa.assignment_type, 'area_access'),
    coalesce(aa.is_primary, false),
    coalesce(aa.commission_rate, 0),
    coalesce(aa.created_at, sm.created_at),
    claim.ambassador_id,
    owner.name,
    claim.secured_at,
    claim.ambassador_id = me.id
  FROM visible sm
  CROSS JOIN me
  LEFT JOIN public.stores s ON s.id = sm.id
  LEFT JOIN LATERAL (
    SELECT x.* FROM public.ambassador_assignments x
    WHERE x.ambassador_id = me.id AND x.store_id = sm.id
      AND x.active IS TRUE AND x.unassigned_at IS NULL
    ORDER BY x.created_at DESC LIMIT 1
  ) aa ON true
  LEFT JOIN public.ambassador_store_claims claim
    ON claim.store_id = sm.id AND claim.released_at IS NULL
  LEFT JOIN public.ambassadors owner ON owner.id = claim.ambassador_id
  ORDER BY sm.store_name, sm.id
$$;

CREATE OR REPLACE FUNCTION public.ambassador_store_claim_status(_store_id uuid)
RETURNS TABLE (
  store_id uuid,
  secured_ambassador_id uuid,
  secured_ambassador_name text,
  secured_at timestamptz,
  secured_by_me boolean,
  can_secure boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT a.id FROM public.ambassadors a
    WHERE a.user_id = auth.uid() AND a.is_active IS TRUE AND a.deleted_at IS NULL
    ORDER BY a.created_at DESC LIMIT 1
  )
  SELECT sm.id, c.ambassador_id, a.name, c.secured_at,
         c.ambassador_id = me.id,
         c.id IS NULL AND public.ambassador_has_store_access(auth.uid(), sm.id)
  FROM public.store_master sm
  CROSS JOIN me
  LEFT JOIN public.ambassador_store_claims c ON c.store_id = sm.id AND c.released_at IS NULL
  LEFT JOIN public.ambassadors a ON a.id = c.ambassador_id
  WHERE sm.id = _store_id AND public.ambassador_has_store_access(auth.uid(), sm.id)
$$;

CREATE OR REPLACE FUNCTION public.secure_store_for_ambassador(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ambassador public.ambassadors%ROWTYPE;
  v_claim public.ambassador_store_claims%ROWTYPE;
  v_owner_name text;
BEGIN
  SELECT * INTO v_ambassador
  FROM public.ambassadors
  WHERE user_id = auth.uid() AND is_active IS TRUE AND deleted_at IS NULL
  ORDER BY created_at DESC LIMIT 1;

  IF v_ambassador.id IS NULL THEN
    RAISE EXCEPTION 'No active ambassador profile is linked to this account';
  END IF;

  IF NOT public.ambassador_has_store_access(auth.uid(), _store_id) THEN
    RAISE EXCEPTION 'This store is outside your current area or field access';
  END IF;

  BEGIN
    INSERT INTO public.ambassador_store_claims (
      store_id, ambassador_id, secured_by_user_id
    ) VALUES (
      _store_id, v_ambassador.id, auth.uid()
    )
    RETURNING * INTO v_claim;
  EXCEPTION WHEN unique_violation THEN
    SELECT c.* INTO v_claim
    FROM public.ambassador_store_claims c
    WHERE c.store_id = _store_id AND c.released_at IS NULL;

    SELECT a.name INTO v_owner_name
    FROM public.ambassadors a
    WHERE a.id = v_claim.ambassador_id;

    RETURN jsonb_build_object(
      'success', false,
      'code', 'ALREADY_SECURED',
      'store_id', _store_id,
      'secured_ambassador_id', v_claim.ambassador_id,
      'secured_ambassador_name', v_owner_name,
      'secured_at', v_claim.secured_at
    );
  END;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'SECURED',
    'store_id', _store_id,
    'secured_ambassador_id', v_claim.ambassador_id,
    'secured_ambassador_name', v_ambassador.name,
    'secured_at', v_claim.secured_at
  );
END
$$;

REVOKE ALL ON FUNCTION public.secure_store_for_ambassador(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.secure_store_for_ambassador(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ambassador_visible_stores() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ambassador_store_claim_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ambassador_visible_store_ids_for_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ambassador_has_store_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.territory_matches_store(text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_us_state(text) TO authenticated, service_role;

COMMENT ON TABLE public.ambassador_store_claims IS 'Explicit secured-store ledger. Territory, ambassador_assignments, routes, check-ins, and visits are access/activity only and never imply a secured claim.';
COMMENT ON FUNCTION public.secure_store_for_ambassador(uuid) IS 'Atomically secures one visible store for the signed-in ambassador. Existing territory, assignment, route, or visit records never create claims.';