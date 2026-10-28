ALTER TABLE public.store_master ADD COLUMN IF NOT EXISTS is_portal_test boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.store_master.is_portal_test IS 'Store portal launch lock: test-only store; may receive portal texts while store portal is not live. Exclude from KPIs/counts.';

CREATE OR REPLACE FUNCTION public.store_portal_is_live()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT (setting_value->>'live')::boolean FROM public.system_settings
                   WHERE setting_key = 'store_portal_live' ORDER BY last_changed_at DESC LIMIT 1), false)
$$;

CREATE OR REPLACE FUNCTION public.store_portal_launch_state()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT setting_value FROM public.system_settings
                   WHERE setting_key = 'store_portal_live' ORDER BY last_changed_at DESC LIMIT 1),
                  '{"live":false,"checklist":{}}'::jsonb)
$$;

CREATE OR REPLACE FUNCTION public.set_store_portal_launch(p_live boolean, p_checklist jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_steps text[] := ARRAY['sign_in_code','update_inventory','request_asap','schedule_delivery','see_on_requests_page','see_in_route_center','add_to_route','confirmation_text'];
  s text; v_new jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Only the owner can change the store portal launch setting';
  END IF;
  IF p_live THEN
    FOREACH s IN ARRAY v_steps LOOP
      IF coalesce((p_checklist->>s)::boolean,false) IS NOT TRUE THEN
        RAISE EXCEPTION 'Finish every test checklist step before turning the store portal on (missing: %)', s;
      END IF;
    END LOOP;
  END IF;
  v_new := jsonb_build_object('live', p_live, 'checklist', coalesce(p_checklist,'{}'::jsonb));
  UPDATE public.system_settings SET setting_value = v_new, last_changed_by = auth.uid(), last_changed_at = now()
   WHERE setting_key = 'store_portal_live';
  IF NOT FOUND THEN
    INSERT INTO public.system_settings(setting_key, setting_value, last_changed_by) VALUES ('store_portal_live', v_new, auth.uid());
  END IF;
  RETURN v_new;
END $$;

REVOKE ALL ON FUNCTION public.set_store_portal_launch(boolean,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_store_portal_launch(boolean,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_portal_is_live() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_portal_launch_state() TO authenticated, service_role;