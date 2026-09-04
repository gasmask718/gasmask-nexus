DO $$
DECLARE oid uuid; cnt int; sample text;
BEGIN
  INSERT INTO public.inbound_call_outcomes (call_sid, kind, summary, reason_category, requested_action, urgency, callback_requested, ai_resolved, unresolved_reason, caller_phone, contact_name)
  VALUES ('TEST_SID_VERIFY_1','callback_request','Wants pricing confirmed','order','Call back with case price','high',true,false,'Pricing not in approved knowledge','+15550001111','Test Caller')
  RETURNING id INTO oid;

  SELECT count(*), max(title || ' || ' || message || ' || ' || coalesce(action_url,''))
    INTO cnt, sample FROM public.notifications WHERE entity_id = oid;

  RAISE NOTICE 'callback notifications=% sample=%', cnt, sample;

  DELETE FROM public.notifications WHERE entity_id = oid;
  DELETE FROM public.inbound_call_outcomes WHERE id = oid;
END $$;