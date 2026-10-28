CREATE OR REPLACE FUNCTION public.invites_link_ambassador_on_accept()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_amb uuid; v_uid uuid := NEW.accepted_user_id;
BEGIN
  IF NEW.role::text <> 'ambassador' OR NEW.status <> 'accepted' OR OLD.status = 'accepted'
     OR v_uid IS NULL OR NOT (coalesce(NEW.target_link,'{}'::jsonb) ? 'ambassador_id') THEN
    RETURN NEW;
  END IF;
  v_amb := (NEW.target_link->>'ambassador_id')::uuid;
  UPDATE public.ambassadors SET user_id = v_uid WHERE id = v_amb AND user_id IS NULL;
  IF NEW.target_link ? 'route_ids' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid) THEN
    UPDATE public.routes SET assigned_to = v_uid
     WHERE assigned_to IS NULL
       AND id IN (SELECT (jsonb_array_elements_text(NEW.target_link->'route_ids'))::uuid);
  END IF;
  INSERT INTO public.portal_security_events (user_id, portal_type, event_type, severity, event_message, metadata)
  VALUES (v_uid, 'ambassador', 'invite_linked', 'info', 'Ambassador invite linked ambassador row and routes',
          jsonb_build_object('invite_id', NEW.id, 'ambassador_id', v_amb, 'route_ids', NEW.target_link->'route_ids'));
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.invites_link_ambassador_on_accept() FROM PUBLIC, anon, authenticated;