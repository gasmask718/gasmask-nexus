
CREATE INDEX IF NOT EXISTS idx_store_contacts_phone_last10
  ON public.store_contacts ((right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 10)));

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
  v_reason  text;
BEGIN
  -- Only fill gaps. Never overwrite an explicit association.
  IF NEW.store_id IS NOT NULL OR NEW.contact_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Skip Twilio delivery-status audit rows (they are not conversations).
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
    -- Same store, several people on the number: attach the store, never guess
    -- which person it was.
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

DROP TRIGGER IF EXISTS trg_autolink_communication_log ON public.communication_logs;
CREATE TRIGGER trg_autolink_communication_log
BEFORE INSERT ON public.communication_logs
FOR EACH ROW EXECUTE FUNCTION public.autolink_communication_log();
