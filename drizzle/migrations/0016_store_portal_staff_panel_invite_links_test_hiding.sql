-- 1) accept_invite references invite_redirect_for_role(), which did not exist (every non-wholesaler accept would error)
CREATE OR REPLACE FUNCTION public.invite_redirect_for_role(p_role text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_role
    WHEN 'ambassador' THEN '/ambassador/dashboard'
    WHEN 'va' THEN '/va/dashboard'
    WHEN 'driver' THEN '/portal/driver'
    WHEN 'biker' THEN '/portal/biker'
    WHEN 'wholesaler' THEN '/portal/wholesaler'
    ELSE '/portal' END
$$;
GRANT EXECUTE ON FUNCTION public.invite_redirect_for_role(text) TO authenticated, service_role;

-- 2) Ambassador invite auto-link on acceptance: target_link {ambassador_id, route_ids[]}
CREATE OR REPLACE FUNCTION public.invites_link_ambassador_on_accept()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amb uuid; v_uid uuid := NEW.accepted_user_id;
BEGIN
  IF NEW.role::text <> 'ambassador' OR NEW.status <> 'accepted' OR OLD.status = 'accepted'
     OR v_uid IS NULL OR NOT (coalesce(NEW.target_link,'{}'::jsonb) ? 'ambassador_id') THEN
    RETURN NEW;
  END IF;
  v_amb := (NEW.target_link->>'ambassador_id')::uuid;
  UPDATE public.ambassadors SET user_id = v_uid, updated_at = now()
   WHERE id = v_amb AND user_id IS NULL;
  IF NEW.target_link ? 'route_ids' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid) THEN
    UPDATE public.routes SET assigned_to = v_uid, updated_at = now()
     WHERE assigned_to IS NULL
       AND id IN (SELECT (jsonb_array_elements_text(NEW.target_link->'route_ids'))::uuid);
  END IF;
  INSERT INTO public.portal_security_events (user_id, portal_type, event_type, severity, event_message, metadata)
  VALUES (v_uid, 'ambassador', 'invite_linked', 'info', 'Ambassador invite linked ambassador row and routes',
          jsonb_build_object('invite_id', NEW.id, 'ambassador_id', v_amb, 'route_ids', NEW.target_link->'route_ids'));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_invites_link_ambassador_on_accept ON public.invites;
CREATE TRIGGER trg_invites_link_ambassador_on_accept AFTER UPDATE OF status ON public.invites
  FOR EACH ROW EXECUTE FUNCTION public.invites_link_ambassador_on_accept();
REVOKE EXECUTE ON FUNCTION public.invites_link_ambassador_on_accept() FROM PUBLIC, anon, authenticated;

-- 3) Hide portal test stores from Route Command Center candidates (their portal delivery requests still show)
DO $$
DECLARE d text;
BEGIN
  d := rtrim(pg_get_viewdef('public.v_route_candidates'::regclass), E'; \n');
  IF position('is_portal_test' in d) = 0 THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.v_route_candidates AS SELECT q.* FROM (' || d || ') q '
         || 'WHERE q.signal_source = ''store_portal'' OR NOT EXISTS (SELECT 1 FROM public.store_master t WHERE t.id = q.store_id AND t.is_portal_test)';
  END IF;
END $$;

-- 4) Staff "Portal" panel on the store profile
CREATE OR REPLACE FUNCTION public.store_portal_admin_panel(p_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv record; v_last_sign timestamptz; v_users int; v_inv_at timestamptz; v_open int; v_test boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_staff(auth.uid()) OR public.ambassador_has_store_access(auth.uid(), p_store_id)) THEN
    RAISE EXCEPTION 'not authorized for this store';
  END IF;
  SELECT status::text AS status, created_at, expires_at, consumed_at INTO v_inv
    FROM public.portal_invites WHERE store_id = p_store_id AND role = 'store'::public.app_role
    ORDER BY created_at DESC LIMIT 1;
  SELECT count(*), max(u.last_sign_in_at) INTO v_users, v_last_sign
    FROM public.store_users su JOIN auth.users u ON u.id = su.user_id WHERE su.store_id = p_store_id;
  SELECT max(tubes_updated_at) INTO v_inv_at FROM public.store_tube_inventory_status
    WHERE store_id = p_store_id AND last_updated_method = 'store_portal';
  SELECT count(*) INTO v_open FROM public.delivery_requests WHERE store_id = p_store_id AND status IN ('new','confirmed','scheduled');
  SELECT is_portal_test INTO v_test FROM public.store_master WHERE id = p_store_id;
  RETURN jsonb_build_object(
    'invite_status', v_inv.status, 'invite_sent_at', v_inv.created_at, 'invite_expires_at', v_inv.expires_at,
    'invite_used_at', v_inv.consumed_at, 'linked_users', v_users, 'last_sign_in_at', v_last_sign,
    'last_inventory_update_at', v_inv_at, 'open_requests', v_open, 'is_portal_test', coalesce(v_test,false),
    'portal_live', public.store_portal_is_live());
END $$;
REVOKE EXECUTE ON FUNCTION public.store_portal_admin_panel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_portal_admin_panel(uuid) TO authenticated;