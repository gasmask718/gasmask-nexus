CREATE OR REPLACE FUNCTION public.store_portal_request_delivery(
  p_store_id uuid, p_request_type text, p_requested_date date, p_time_window text,
  p_items jsonb, p_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_item jsonb; v_batch uuid := nullif(current_setting('app.portal_batch_id', true), '')::uuid;
BEGIN
  PERFORM public._assert_store_portal_access(p_store_id);
  IF NOT public.store_portal_store_orderable(p_store_id) THEN
    RAISE EXCEPTION 'This store is waiting for approval and cannot receive orders yet';
  END IF;
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
    IF COALESCE(v_item->>'name','') = '' OR COALESCE((v_item->>'quantity')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'each item needs a name and a quantity';
    END IF;
  END LOOP;
  INSERT INTO public.delivery_requests
    (store_id, requested_by, request_type, requested_date, time_window, items, notes, status, batch_id)
  VALUES (p_store_id, auth.uid(), p_request_type,
          CASE WHEN p_request_type = 'scheduled' THEN p_requested_date END,
          CASE WHEN p_request_type = 'scheduled' THEN p_time_window END,
          p_items, nullif(left(btrim(COALESCE(p_notes,'')), 1000), ''), 'new', v_batch)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;