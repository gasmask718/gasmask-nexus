CREATE OR REPLACE FUNCTION public.auto_mark_responsive_on_inbound()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_d10 text;
  v_contact record;
  v_is_answered boolean;
  v_channel_label text;
BEGIN
  IF NEW.direction <> 'inbound' THEN RETURN NEW; END IF;
  IF NEW.channel NOT IN ('sms','call') THEN RETURN NEW; END IF;

  v_d10 := right(regexp_replace(coalesce(NEW.sender_phone,''), '\D', '', 'g'), 10);
  IF length(v_d10) <> 10 THEN RETURN NEW; END IF;

  IF NEW.channel = 'call' THEN
    v_is_answered :=
      (NEW.status IS NOT NULL AND lower(NEW.status) IN ('completed','answered','in-progress'))
      OR (NEW.call_duration IS NOT NULL AND NEW.call_duration > 0)
      OR (NEW.delivery_status IS NOT NULL AND lower(NEW.delivery_status) IN ('answered','completed','in_progress'));
    IF NOT v_is_answered THEN RETURN NEW; END IF;
  END IF;

  -- Prefer a contact whose store_id matches the already-set NEW.store_id when present
  SELECT id, store_id, name
    INTO v_contact
    FROM public.store_contacts
   WHERE right(regexp_replace(coalesce(phone,''), '\D','', 'g'), 10) = v_d10
     AND (NEW.store_id IS NULL OR store_id = NEW.store_id)
   ORDER BY is_primary DESC NULLS LAST, created_at ASC
   LIMIT 1;

  IF NOT FOUND THEN
    -- Fallback: any contact matching this number
    SELECT id, store_id, name
      INTO v_contact
      FROM public.store_contacts
     WHERE right(regexp_replace(coalesce(phone,''), '\D','', 'g'), 10) = v_d10
     ORDER BY is_primary DESC NULLS LAST, created_at ASC
     LIMIT 1;
    IF NOT FOUND THEN RETURN NEW; END IF;
  END IF;

  IF NEW.channel = 'sms' THEN
    UPDATE public.store_contacts
       SET responsive_by_text = true,
           last_text_received_at = COALESCE(NEW.created_at, now()),
           last_responded_at = COALESCE(NEW.created_at, now()),
           total_texts_received = COALESCE(total_texts_received,0) + 1,
           responsiveness_status = 'responsive',
           responsiveness_updated_at = now()
     WHERE id = v_contact.id;
    v_channel_label := 'inbound text';
  ELSE
    UPDATE public.store_contacts
       SET responsive_by_call = true,
           last_call_answered_at = COALESCE(NEW.created_at, now()),
           last_responded_at = COALESCE(NEW.created_at, now()),
           total_calls_answered = COALESCE(total_calls_answered,0) + 1,
           responsiveness_status = 'responsive',
           responsiveness_updated_at = now()
     WHERE id = v_contact.id;
    v_channel_label := 'inbound call';
  END IF;

  -- Backfill missing store_id AND contact_id on the log
  UPDATE public.communication_logs
     SET store_id = COALESCE(store_id, v_contact.store_id),
         contact_id = COALESCE(contact_id, v_contact.id),
         follow_up_required = CASE WHEN store_id IS NULL AND v_contact.store_id IS NOT NULL THEN false ELSE follow_up_required END
   WHERE id = NEW.id
     AND (contact_id IS NULL OR store_id IS NULL);

  BEGIN
    INSERT INTO public.account_notes (entity_type, entity_id, note_type, note_body, created_by)
    VALUES ('store_contact', v_contact.id, 'responsiveness',
            'Auto-marked responsive: ' || v_channel_label || ' on ' || to_char(now(),'YYYY-MM-DD HH24:MI'),
            'system:auto');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$function$;