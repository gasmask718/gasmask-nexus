-- 1. SECURITY DEFINER RPC: single chokepoint for resolving or creating a store_master row.
--    Bypasses RLS for the existence check so scoped users never trigger duplicate creation.
CREATE OR REPLACE FUNCTION public.resolve_or_create_store_master(
  _store_id uuid DEFAULT NULL,
  _legacy_store_id uuid DEFAULT NULL,
  _store_name text DEFAULT NULL,
  _address text DEFAULT NULL,
  _city text DEFAULT NULL,
  _state text DEFAULT NULL,
  _zip text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _store_type text DEFAULT NULL,
  _owner_name text DEFAULT NULL,
  _is_simulation boolean DEFAULT false,
  _allow_create boolean DEFAULT true
)
RETURNS public.store_master
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing public.store_master;
  legacy  public.stores;
  new_row public.store_master;
  resolved_name text;
  resolved_addr text;
  resolved_city text;
  resolved_state text;
  resolved_zip text;
  resolved_phone text;
  resolved_email text;
  resolved_type text;
  resolved_owner text;
BEGIN
  -- 1. Direct hit on store_master by id (RLS-bypassed via SECURITY DEFINER)
  IF _store_id IS NOT NULL THEN
    SELECT * INTO existing FROM public.store_master WHERE id = _store_id LIMIT 1;
    IF FOUND THEN
      RETURN existing;
    END IF;
  END IF;

  -- 2. Try to find the legacy stores row (either by provided legacy id OR by the same id)
  IF _legacy_store_id IS NOT NULL THEN
    SELECT * INTO legacy FROM public.stores WHERE id = _legacy_store_id LIMIT 1;
  ELSIF _store_id IS NOT NULL THEN
    SELECT * INTO legacy FROM public.stores WHERE id = _store_id LIMIT 1;
  END IF;

  resolved_name  := COALESCE(_store_name, legacy.name);
  resolved_addr  := COALESCE(_address, legacy.address_street);
  resolved_city  := COALESCE(_city, legacy.address_city);
  resolved_state := COALESCE(_state, legacy.address_state);
  resolved_zip   := COALESCE(_zip, legacy.address_zip);
  resolved_phone := COALESCE(_phone, legacy.phone);
  resolved_email := COALESCE(_email, legacy.email);
  resolved_type  := COALESCE(_store_type, legacy.type, 'retail');
  resolved_owner := COALESCE(_owner_name, legacy.primary_contact_name);

  -- 3. Match by name (RLS-bypassed) BEFORE we ever insert. This is what prevents duplicates
  --    when a scoped user can't see the row in their RLS view.
  IF resolved_name IS NOT NULL THEN
    SELECT * INTO existing
    FROM public.store_master
    WHERE lower(store_name) = lower(resolved_name)
    LIMIT 1;
    IF FOUND THEN
      RETURN existing;
    END IF;
  END IF;

  -- 4. Genuinely absent. Only create if caller explicitly allowed it.
  IF NOT _allow_create THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.store_master (
    store_name, address, city, state, zip, phone, email,
    store_type, owner_name, notes, has_expansion, influence_level,
    risk_score, is_simulation
  ) VALUES (
    COALESCE(resolved_name, 'Store ' || COALESCE(substring(_store_id::text, 1, 8), 'Unknown')),
    COALESCE(resolved_addr, 'Address Pending'),
    COALESCE(resolved_city, 'City Pending'),
    COALESCE(resolved_state, 'NY'),
    COALESCE(resolved_zip, '00000'),
    resolved_phone,
    resolved_email,
    resolved_type,
    resolved_owner,
    '',
    false,
    'medium',
    'low',
    COALESCE(_is_simulation, false)
  )
  RETURNING * INTO new_row;

  RETURN new_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_or_create_store_master(
  uuid, uuid, text, text, text, text, text, text, text, text, text, boolean, boolean
) TO authenticated, service_role;

-- 2. INDEX for routes.assigned_to (RLS performance prerequisite)
CREATE INDEX IF NOT EXISTS idx_routes_assigned_to ON public.routes(assigned_to);