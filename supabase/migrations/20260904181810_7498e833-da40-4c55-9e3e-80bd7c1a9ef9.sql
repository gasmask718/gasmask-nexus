CREATE OR REPLACE FUNCTION public.autolink_communication_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone   text;
  v_last10  text;
  v_contacts int;
  v_stores   int;
  v_contact_id uuid;
  v_store_id   uuid;
  v_thread record;
  v_reason  text;
BEGIN
  IF NEW.store_id IS NOT NULL OR NEW.contact_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF coalesce(NEW.summary,'') LIKE 'Twilio delivery status:%' THEN
    RETURN NEW;
  END IF;

  v_phone := CASE
    WHEN NEW.direction = 'inbound' THEN coalesce(NEW.sender_phone, NEW.recipient_phone)
    ELSE coalesce(NEW.recipient_phone, NEW.sender_phone)
  END;

  v_last10 := right(regexp_replace(coalesce(v_phone,''), '\D', '', 'g'), 10);
  IF length(v_last10) <> 10 THEN
    RETURN NEW;
  END IF;

  -- 1. CONVERSATION CONTEXT FIRST. An inbound reply belongs to the thread it
  --    is replying to, never to a fresh global phone lookup.
  IF NEW.direction = 'inbound' THEN
    SELECT cl.store_id, cl.contact_id, cl.created_at
      INTO v_thread
    FROM public.communication_logs cl
    WHERE cl.direction = 'outbound'
      AND cl.store_id IS NOT NULL
      AND coalesce(cl.summary,'') NOT LIKE 'Twilio delivery status:%'
      AND right(regexp_replace(coalesce(cl.recipient_phone,''), '\D', '', 'g'), 10) = v_last10
      AND cl.created_at > now() - interval '30 days'
    ORDER BY cl.created_at DESC
    LIMIT 1;

    IF v_thread.store_id IS NOT NULL THEN
      NEW.store_id   := v_thread.store_id;
      NEW.contact_id := v_thread.contact_id;
      NEW.metadata := coalesce(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
        'auto_link', jsonb_build_object(
          'result', 'linked_conversation_thread',
          'phone_last10', v_last10,
          'thread_outbound_at', v_thread.created_at,
          'at', now()
        )
      );
      RETURN NEW;
    END IF;
  END IF;

  -- 2. No conversation context: fall back to phone match, never guessing
  --    between multiple stores.
  SELECT count(DISTINCT sc.id), count(DISTINCT sc.store_id),
         min(sc.id), min(sc.store_id)
    INTO v_contacts, v_stores, v_contact_id, v_store_id
  FROM public.store_contacts sc
  WHERE right(regexp_replace(coalesce(sc.phone,''), '\D', '', 'g'), 10) = v_last10
    AND sc.store_id IS NOT NULL;

  IF v_contacts = 1 THEN
    NEW.contact_id := v_contact_id;
    NEW.store_id   := v_store_id;
    v_reason := 'linked_single_contact';
  ELSIF v_contacts > 1 AND v_stores = 1 THEN
    NEW.store_id := v_store_id;
    NEW.follow_up_required := true;
    v_reason := 'ambiguous_contact_same_store';
  ELSIF v_contacts > 1 THEN
    NEW.follow_up_required := true;
    v_reason := 'ambiguous_multiple_stores';
  ELSE
    NEW.follow_up_required := true;
    v_reason := 'unmatched_number';
  END IF;

  NEW.metadata := coalesce(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
    'auto_link', jsonb_build_object(
      'result', v_reason,
      'phone_last10', v_last10,
      'contact_matches', v_contacts,
      'store_matches', v_stores,
      'at', now()
    )
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.autolink_communication_log() FROM anon, authenticated;

-- Re-evaluate the two real inbound replies under the corrected rule.
UPDATE public.communication_logs cl
SET store_id = t.store_id,
    contact_id = t.contact_id,
    metadata = coalesce(cl.metadata,'{}'::jsonb) || jsonb_build_object(
      'auto_link', jsonb_build_object(
        'result', 'linked_conversation_thread',
        'phone_last10', '7183089391',
        'corrected_from_store_id', cl.store_id,
        'corrected_from_contact_id', cl.contact_id,
        'thread_outbound_at', t.created_at,
        'at', now()
      )
    )
FROM (
  SELECT store_id, contact_id, created_at
  FROM public.communication_logs
  WHERE direction = 'outbound'
    AND channel = 'sms'
    AND store_id IS NOT NULL
    AND right(regexp_replace(coalesce(recipient_phone,''), '\D','','g'),10) = '7183089391'
    AND created_at < '2026-09-04 17:19:00+00'
  ORDER BY created_at DESC
  LIMIT 1
) t
WHERE cl.id IN (
  'f67788ec-1785-4959-935f-668e84c8e599',
  'ae0e9b6d-00a4-4ef5-9c4a-6a279a465330'
);