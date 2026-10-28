CREATE TABLE public.store_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  store_id uuid NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (user_id, store_id)
);
GRANT SELECT ON public.store_users TO authenticated;
GRANT ALL ON public.store_users TO service_role;
ALTER TABLE public.store_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY store_users_select_own ON public.store_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE TABLE public.store_portal_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.portal_invites(id) ON DELETE CASCADE,
  phone text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.store_portal_codes TO service_role;
ALTER TABLE public.store_portal_codes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_store_user_for(_user_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _user_id IS NOT NULL AND _store_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.store_users su
    JOIN public.store_master mine ON mine.id = su.store_id
    JOIN public.store_master target ON target.id = _store_id
    WHERE su.user_id = _user_id
      AND (
        su.store_id = _store_id
        OR (mine.connected_group_id IS NOT NULL AND mine.connected_group_id = target.connected_group_id)
        OR (mine.owner_group_id IS NOT NULL AND mine.owner_group_id = target.owner_group_id)
      )
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_store_user_for(uuid, uuid) TO authenticated;

CREATE TABLE public.delivery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  requested_by uuid,
  request_type text NOT NULL DEFAULT 'asap' CHECK (request_type IN ('asap','scheduled')),
  requested_date date,
  time_window text CHECK (time_window IN ('morning','afternoon','evening')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','confirmed','scheduled','delivered','cancelled')),
  assigned_to uuid,
  route_id uuid REFERENCES public.routes(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX delivery_requests_store_status_idx ON public.delivery_requests (store_id, status);
GRANT SELECT, INSERT, UPDATE ON public.delivery_requests TO authenticated;
GRANT ALL ON public.delivery_requests TO service_role;
ALTER TABLE public.delivery_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY delivery_requests_store_select ON public.delivery_requests FOR SELECT TO authenticated
  USING (public.is_store_user_for(auth.uid(), store_id));
CREATE POLICY delivery_requests_store_insert ON public.delivery_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_store_user_for(auth.uid(), store_id) AND requested_by = auth.uid());
CREATE POLICY delivery_requests_store_cancel ON public.delivery_requests FOR UPDATE TO authenticated
  USING (public.is_store_user_for(auth.uid(), store_id) AND status = 'new')
  WITH CHECK (public.is_store_user_for(auth.uid(), store_id) AND status = 'cancelled');
CREATE POLICY delivery_requests_staff_all ON public.delivery_requests FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.ambassador_has_store_access(auth.uid(), store_id))
  WITH CHECK (public.is_staff(auth.uid()) OR public.ambassador_has_store_access(auth.uid(), store_id));

CREATE OR REPLACE FUNCTION public.delivery_requests_guard_store_update()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF public.is_store_user_for(auth.uid(), NEW.store_id)
     AND NOT public.is_staff(auth.uid())
     AND NOT public.ambassador_has_store_access(auth.uid(), NEW.store_id) THEN
    IF OLD.status <> 'new' OR NEW.status <> 'cancelled'
       OR NEW.store_id IS DISTINCT FROM OLD.store_id
       OR NEW.requested_by IS DISTINCT FROM OLD.requested_by
       OR NEW.request_type IS DISTINCT FROM OLD.request_type
       OR NEW.requested_date IS DISTINCT FROM OLD.requested_date
       OR NEW.time_window IS DISTINCT FROM OLD.time_window
       OR NEW.items IS DISTINCT FROM OLD.items
       OR NEW.notes IS DISTINCT FROM OLD.notes THEN
      RAISE EXCEPTION 'Stores can only cancel a new delivery request';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_delivery_requests_guard BEFORE UPDATE ON public.delivery_requests
  FOR EACH ROW EXECUTE FUNCTION public.delivery_requests_guard_store_update();
CREATE TRIGGER trg_delivery_requests_updated_at BEFORE UPDATE ON public.delivery_requests
  FOR EACH ROW EXECUTE FUNCTION public.amt_set_updated_at();

CREATE OR REPLACE FUNCTION public.portal_invite_info(p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_invite public.portal_invites%ROWTYPE; v_store_name text;
BEGIN
  SELECT * INTO v_invite FROM public.portal_invites WHERE token_hash = p_token_hash;
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false, 'error', 'Invalid invite link'); END IF;
  IF v_invite.status <> 'active' OR v_invite.expires_at < now() OR v_invite.uses >= v_invite.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invite is no longer active', 'role', v_invite.role::text);
  END IF;
  IF v_invite.store_id IS NOT NULL THEN
    SELECT store_name INTO v_store_name FROM public.store_master WHERE id = v_invite.store_id;
  END IF;
  RETURN jsonb_build_object(
    'valid', true,
    'role', v_invite.role::text,
    'store_name', v_store_name,
    'phone_last4', CASE WHEN v_invite.phone IS NOT NULL THEN right(regexp_replace(v_invite.phone, '\D', '', 'g'), 4) END
  );
END $$;
GRANT EXECUTE ON FUNCTION public.portal_invite_info(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public._assert_store_portal_access(p_store_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'store'::public.app_role)
     OR NOT public.is_store_user_for(auth.uid(), p_store_id) THEN
    RAISE EXCEPTION 'not authorized for this store';
  END IF;
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
  ORDER BY sm.store_name
$$;
GRANT EXECUTE ON FUNCTION public.store_portal_stores() TO authenticated;

CREATE OR REPLACE FUNCTION public.store_portal_home(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_store public.store_master%ROWTYPE; v_balance numeric; v_last_order date;
        v_amb_name text; v_amb_phone text; v_open int;
BEGIN
  PERFORM public._assert_store_portal_access(p_store_id);
  SELECT * INTO v_store FROM public.store_master WHERE id = p_store_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'store not found'; END IF;
  SELECT COALESCE(sum(COALESCE(i.total_amount, i.total, 0) - COALESCE(i.amount_paid, 0)), 0)
    INTO v_balance FROM public.invoices i
    WHERE i.store_id = p_store_id AND i.deleted_at IS NULL
      AND i.payment_status IN ('unpaid','partial');
  SELECT max(COALESCE(i.business_date, i.created_at::date)) INTO v_last_order
    FROM public.invoices i
    WHERE i.store_id = p_store_id AND i.deleted_at IS NULL AND i.status = 'finalized';
  IF v_store.assigned_ambassador_id IS NOT NULL THEN
    SELECT a.name, COALESCE(a.phone_primary, a.personal_phone) INTO v_amb_name, v_amb_phone
    FROM public.ambassadors a
    WHERE a.id = v_store.assigned_ambassador_id AND a.deleted_at IS NULL;
  END IF;
  SELECT count(*) INTO v_open FROM public.delivery_requests dr
    WHERE dr.store_id = p_store_id AND dr.status IN ('new','confirmed','scheduled');
  RETURN jsonb_build_object(
    'store', jsonb_build_object('id', v_store.id, 'store_name', v_store.store_name,
      'address', v_store.address, 'city', v_store.city, 'state', v_store.state, 'zip', v_store.zip),
    'balance_owed', v_balance,
    'last_order_date', v_last_order,
    'ambassador_name', v_amb_name,
    'ambassador_phone', v_amb_phone,
    'open_requests', v_open
  );
END $$;
GRANT EXECUTE ON FUNCTION public.store_portal_home(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.store_portal_inventory(p_store_id uuid)
RETURNS TABLE(brand_id text, brand_name text, current_tubes_left integer, tubes_updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT t.brand_id, t.brand_name, t.current_tubes_left, t.tubes_updated_at
  FROM public.store_tube_inventory_status t
  WHERE t.store_id = p_store_id
    AND COALESCE(t.is_simulation, false) IS FALSE
    AND COALESCE(t.is_active, true) IS TRUE
    AND public.has_role(auth.uid(), 'store'::public.app_role)
    AND public.is_store_user_for(auth.uid(), p_store_id)
$$;
GRANT EXECUTE ON FUNCTION public.store_portal_inventory(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.store_portal_save_inventory(p_store_id uuid, p_counts jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_item jsonb; v_brand text; v_count int; v_low boolean := false;
        v_summary text := ''; v_brand_name text;
        v_allowed text[] := ARRAY['gasmasktubes','gasmask','hotmama','grabba_r_us',
          'hotscolatti-light','hotscolatti-dark','hotscalatimixpack','hotscalatibros'];
        v_names jsonb := '{"gasmasktubes":"GasMask Tubes","gasmask":"GasMask Bags","hotmama":"Hot Mama","grabba_r_us":"Grabba R Us","hotscolatti-light":"Hotscolatti Light","hotscolatti-dark":"Hotscolatti Dark","hotscalatimixpack":"Hotscolatti Mix Pack","hotscalatibros":"Hotscolatti Bros"}'::jsonb;
BEGIN
  PERFORM public._assert_store_portal_access(p_store_id);
  IF jsonb_typeof(p_counts) <> 'array' OR jsonb_array_length(p_counts) = 0 OR jsonb_array_length(p_counts) > 20 THEN
    RAISE EXCEPTION 'counts must be a non-empty array';
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_counts) LOOP
    v_brand := v_item->>'brand_id';
    IF v_brand IS NULL OR NOT (v_brand = ANY(v_allowed)) THEN
      RAISE EXCEPTION 'unknown brand: %', COALESCE(v_brand, 'null');
    END IF;
    v_count := (v_item->>'count')::int;
    IF v_count IS NULL OR v_count < 0 OR v_count > 100000 THEN
      RAISE EXCEPTION 'invalid count for %', v_brand;
    END IF;
    v_brand_name := v_names->>v_brand;
    INSERT INTO public.store_tube_inventory_status
      (store_id, brand_id, brand_name, current_tubes_left, needs_order,
       last_updated_by, last_updated_by_role, last_updated_method,
       last_updated_at, tubes_updated_at, is_simulation)
    VALUES (p_store_id, v_brand, v_brand_name, v_count, v_count <= 25,
            auth.uid(), 'store', 'store_portal', now(), now(), false)
    ON CONFLICT (store_id, brand_id, is_simulation) DO UPDATE SET
      current_tubes_left = EXCLUDED.current_tubes_left,
      needs_order = EXCLUDED.needs_order,
      last_updated_by = EXCLUDED.last_updated_by,
      last_updated_by_role = EXCLUDED.last_updated_by_role,
      last_updated_method = EXCLUDED.last_updated_method,
      last_updated_at = now(),
      tubes_updated_at = now();
    IF v_count <= 25 THEN v_low := true; END IF;
    v_summary := v_summary || CASE WHEN v_summary = '' THEN '' ELSE ', ' END || v_brand_name || ' ' || v_count || ' left';
  END LOOP;
  INSERT INTO public.store_notes (store_id, note_text, created_by, note_date, source)
  VALUES (p_store_id, 'Store updated inventory via portal: ' || v_summary, auth.uid(), CURRENT_DATE, 'store_portal');
  RETURN jsonb_build_object('success', true, 'any_low', v_low);
END $$;
GRANT EXECUTE ON FUNCTION public.store_portal_save_inventory(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.store_portal_request_delivery(
  p_store_id uuid, p_request_type text, p_requested_date date, p_time_window text,
  p_items jsonb, p_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_item jsonb;
BEGIN
  PERFORM public._assert_store_portal_access(p_store_id);
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
    IF COALESCE(v_item->>'name','') = '' OR COALESCE((v_item->>'quantity')::int, 0) < 1 THEN
      RAISE EXCEPTION 'each item needs a name and a quantity of at least 1';
    END IF;
  END LOOP;
  INSERT INTO public.delivery_requests
    (store_id, requested_by, request_type, requested_date, time_window, items, notes, status)
  VALUES (p_store_id, auth.uid(), p_request_type,
          CASE WHEN p_request_type = 'scheduled' THEN p_requested_date END,
          CASE WHEN p_request_type = 'scheduled' THEN p_time_window END,
          p_items, left(COALESCE(p_notes,''), 1000), 'new')
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.store_portal_request_delivery(uuid, text, date, text, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.store_portal_requests(p_store_id uuid)
RETURNS SETOF public.delivery_requests
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT dr.* FROM public.delivery_requests dr
  WHERE dr.store_id = p_store_id
    AND public.has_role(auth.uid(), 'store'::public.app_role)
    AND public.is_store_user_for(auth.uid(), p_store_id)
  ORDER BY dr.created_at DESC
$$;
GRANT EXECUTE ON FUNCTION public.store_portal_requests(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.store_portal_cancel_request(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_req public.delivery_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.delivery_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  PERFORM public._assert_store_portal_access(v_req.store_id);
  IF v_req.status <> 'new' THEN RAISE EXCEPTION 'only a new request can be cancelled'; END IF;
  UPDATE public.delivery_requests SET status = 'cancelled' WHERE id = p_request_id;
  RETURN jsonb_build_object('success', true);
END $$;
GRANT EXECUTE ON FUNCTION public.store_portal_cancel_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_portal_invite(p_token_hash text, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite portal_invites%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT * INTO v_invite
  FROM portal_invites
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invite link');
  END IF;

  IF v_invite.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite is no longer active');
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE portal_invites SET status = 'expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'This invite has expired');
  END IF;

  IF v_invite.uses >= v_invite.max_uses THEN
    UPDATE portal_invites SET status = 'consumed' WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'This invite has been fully used');
  END IF;

  UPDATE portal_invites
  SET uses = uses + 1,
      consumed_by = p_user_id,
      consumed_at = now(),
      status = CASE WHEN uses + 1 >= max_uses THEN 'consumed'::portal_invite_status ELSE 'active'::portal_invite_status END
  WHERE id = v_invite.id;

  INSERT INTO user_roles (user_id, role)
  VALUES (p_user_id, v_invite.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF v_invite.role = 'store'::public.app_role AND v_invite.store_id IS NOT NULL THEN
    INSERT INTO public.store_users (user_id, store_id, created_by)
    SELECT p_user_id, sm.id, v_invite.created_by
    FROM public.store_master sm
    WHERE sm.deleted_at IS NULL AND (
      sm.id = v_invite.store_id
      OR (sm.connected_group_id IS NOT NULL
          AND sm.connected_group_id = (SELECT connected_group_id FROM public.store_master WHERE id = v_invite.store_id))
      OR (sm.owner_group_id IS NOT NULL
          AND sm.owner_group_id = (SELECT owner_group_id FROM public.store_master WHERE id = v_invite.store_id))
    )
    ON CONFLICT (user_id, store_id) DO NOTHING;

    UPDATE public.profiles SET role = 'store'::public.app_role
    WHERE id = p_user_id AND role IN ('pending'::public.app_role, 'customer'::public.app_role);
  END IF;

  INSERT INTO portal_security_events (user_id, portal_type, event_type, severity, event_message, metadata)
  VALUES (
    p_user_id,
    v_invite.role::text,
    'invite_redeemed',
    'info',
    'User redeemed portal invite',
    jsonb_build_object('invite_id', v_invite.id, 'role', v_invite.role, 'store_id', v_invite.store_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'role', v_invite.role,
    'store_id', v_invite.store_id,
    'invite_id', v_invite.id
  );
END;
$function$;