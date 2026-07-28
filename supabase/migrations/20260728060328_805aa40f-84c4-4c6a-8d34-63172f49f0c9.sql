-- 1) Cadence board: exclude bad numbers from the retry queue
CREATE OR REPLACE VIEW public.v_contact_cadence_intelligence AS
 SELECT sc.id AS contact_id,
    sc.store_id,
    sc.name AS contact_name,
    sc.phone,
    sc.role AS contact_role,
    sc.is_primary,
    sm.store_name,
    sm.address AS store_address,
    sm.city AS store_city,
    sm.state AS store_state,
    COALESCE(sc.total_calls_attempted, 0) AS total_calls_attempted,
    COALESCE(sc.total_calls_answered, 0) AS total_calls_answered,
    sc.last_call_attempt_at,
    sc.last_call_answered_at,
    COALESCE(sc.total_texts_sent, 0) AS total_texts_sent,
    COALESCE(sc.total_texts_received, 0) AS total_texts_received,
    sc.last_text_sent_at,
    sc.last_text_received_at,
    COALESCE(sc.responsiveness_status, 'unknown'::text) AS responsiveness_status,
    COALESCE(sc.responsive_by_call, false) AS responsive_by_call,
    COALESCE(sc.responsive_by_text, false) AS responsive_by_text,
    sc.last_responded_at,
    COALESCE(sc.cadence_status, 'never_contacted'::text) AS cadence_status,
    COALESCE(sc.escalation_flag, false) AS escalation_flag,
    sc.cadence_updated_at,
    (LEAST(COALESCE((EXTRACT(epoch FROM (now() - sc.last_call_attempt_at)) / (86400)::numeric), (999)::numeric), COALESCE((EXTRACT(epoch FROM (now() - sc.last_text_sent_at)) / (86400)::numeric), (999)::numeric)))::integer AS days_since_last_touch,
    GREATEST(COALESCE(sc.last_call_attempt_at, '1970-01-01 00:00:00+00'::timestamptz), COALESCE(sc.last_text_sent_at, '1970-01-01 00:00:00+00'::timestamptz)) AS last_touch_at,
        CASE
            WHEN ((COALESCE(sc.responsiveness_status, 'unknown'::text) = 'unresponsive'::text) AND COALESCE(sc.escalation_flag, false)) THEN 'physical_visit'::text
            WHEN (COALESCE(sc.responsive_by_call, false) = true) THEN 'call'::text
            WHEN (COALESCE(sc.responsive_by_text, false) = true) THEN 'text'::text
            ELSE 'call'::text
        END AS suggested_action,
    sc.created_at
   FROM (store_contacts sc
     LEFT JOIN store_master sm ON ((sm.id = sc.store_id)))
  WHERE COALESCE(sc.responsiveness_status, 'unknown') NOT IN ('wrong_number','not_active');

-- 2) Replacement worklist
CREATE OR REPLACE VIEW public.v_contacts_needing_new_number AS
 SELECT sc.id AS contact_id,
    sc.store_id,
    sc.name AS contact_name,
    sc.phone AS bad_phone,
    sc.responsiveness_status,
    sc.role AS contact_role,
    sc.is_primary,
    sc.is_homie,
    sc.owner_confirmed,
    sm.store_name,
    sm.address AS store_address,
    sm.city AS store_city,
    sm.state AS store_state,
    sc.last_responded_at
   FROM store_contacts sc
   LEFT JOIN store_master sm ON sm.id = sc.store_id
  WHERE sc.responsiveness_status IN ('wrong_number','not_active');

GRANT SELECT ON public.v_contacts_needing_new_number TO authenticated;
GRANT SELECT ON public.v_contacts_needing_new_number TO service_role;

-- 3) Cadence status job: skip bad numbers
CREATE OR REPLACE FUNCTION public.compute_contact_cadence_status()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact RECORD;
  v_days_since_touch integer;
  v_new_status text;
  v_should_escalate boolean;
BEGIN
  FOR v_contact IN
    SELECT id, last_call_attempt_at, last_text_sent_at, last_responded_at,
           responsiveness_status, total_calls_attempted, total_texts_sent
    FROM store_contacts
    WHERE phone IS NOT NULL AND phone != ''
      AND COALESCE(responsiveness_status,'unknown') NOT IN ('wrong_number','not_active')
  LOOP
    v_days_since_touch := LEAST(
      COALESCE(EXTRACT(EPOCH FROM (now() - v_contact.last_call_attempt_at)) / 86400, 999)::integer,
      COALESCE(EXTRACT(EPOCH FROM (now() - v_contact.last_text_sent_at)) / 86400, 999)::integer
    );
    IF v_days_since_touch >= 999 THEN
      v_new_status := 'never_contacted';
    ELSIF v_days_since_touch <= 7 THEN
      v_new_status := 'within_window';
    ELSIF v_days_since_touch <= 10 THEN
      v_new_status := 'due_soon';
    ELSIF v_days_since_touch <= 14 THEN
      v_new_status := 'overdue_7_days';
    ELSE
      v_new_status := 'overdue_14_days';
    END IF;
    v_should_escalate := (
      v_days_since_touch > 14
      AND v_contact.responsiveness_status = 'unresponsive'
      AND (v_contact.total_calls_attempted >= 3 OR v_contact.total_texts_sent >= 3)
    );
    UPDATE store_contacts
    SET cadence_status = v_new_status,
        escalation_flag = v_should_escalate,
        cadence_updated_at = now()
    WHERE id = v_contact.id;
  END LOOP;
END;
$function$;

-- 4) Outreach planner: never schedule a call/text to a bad number
CREATE OR REPLACE FUNCTION public.generate_store_outreach_plan(p_store_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_policy store_cadence_policy%ROWTYPE;
  v_plan_id UUID;
  v_contact RECORD;
  v_scheduled_at TIMESTAMPTZ;
  v_item_count INTEGER := 0;
BEGIN
  SELECT * INTO v_policy FROM store_cadence_policy WHERE store_id = p_store_id;

  IF NOT FOUND OR NOT v_policy.enabled THEN
    RAISE EXCEPTION 'No enabled cadence policy for store %', p_store_id;
  END IF;

  INSERT INTO outreach_plans (store_id, window_start, window_end)
  VALUES (p_store_id, now(), now() + (v_policy.cadence_days || ' days')::interval)
  RETURNING id INTO v_plan_id;

  v_scheduled_at := now();

  FOR v_contact IN
    SELECT id, name, can_receive_sms
    FROM store_contacts
    WHERE store_id = p_store_id
      AND COALESCE(responsiveness_status,'unknown') NOT IN ('wrong_number','not_active')
    ORDER BY is_primary DESC, created_at ASC
  LOOP
    IF v_policy.text_first AND v_contact.can_receive_sms AND v_item_count < v_policy.max_texts_per_window THEN
      INSERT INTO outreach_plan_items (plan_id, contact_id, channel, scheduled_at)
      VALUES (v_plan_id, v_contact.id, 'text', v_scheduled_at);
      v_item_count := v_item_count + 1;
    END IF;

    IF v_item_count < (v_policy.max_texts_per_window + v_policy.max_calls_per_window) THEN
      INSERT INTO outreach_plan_items (plan_id, contact_id, channel, scheduled_at)
      VALUES (v_plan_id, v_contact.id, 'call', v_scheduled_at + interval '3 days');
      v_item_count := v_item_count + 1;
    END IF;
  END LOOP;

  UPDATE outreach_plans SET total_items = v_item_count WHERE id = v_plan_id;

  RETURN v_plan_id;
END;
$function$;

-- 5) Audience resolution: don't pick a bad contact number as the store's phone
CREATE OR REPLACE FUNCTION public.resolve_audience_segment(p_segment_id uuid)
 RETURNS TABLE(store_id uuid, store_name text, phone text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_type text;
BEGIN
  SELECT segment_type INTO v_type FROM public.audience_segments WHERE id = p_segment_id;
  IF v_type = 'previous_customers' THEN
    RETURN QUERY SELECT r.store_id, r.store_name, r.phone FROM public.resolve_previous_customers(3650) r;
  ELSE
    RETURN QUERY
    SELECT asm.store_id, sm.store_name, COALESCE(sm.phone, sc.phone) AS phone
    FROM public.audience_segment_members asm
    JOIN public.store_master sm ON sm.id = asm.store_id
    LEFT JOIN LATERAL (
      SELECT scc.phone FROM public.store_contacts scc
      WHERE scc.store_id = sm.id
        AND public.normalize_phone(scc.phone) IS NOT NULL
        AND COALESCE(scc.responsiveness_status,'unknown') NOT IN ('wrong_number','not_active')
      ORDER BY scc.is_primary DESC NULLS LAST, scc.created_at DESC LIMIT 1
    ) sc ON true
    WHERE asm.segment_id = p_segment_id;
  END IF;
END;
$function$;