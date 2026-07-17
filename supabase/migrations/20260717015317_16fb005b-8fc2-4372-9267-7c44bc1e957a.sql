
-- R9a: auto-mark responsive on inbound sms/call + backfill orphans via last-10 phone match

CREATE OR REPLACE FUNCTION public.auto_mark_responsive_on_inbound()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- For calls: only auto-mark on truly answered calls
  IF NEW.channel = 'call' THEN
    v_is_answered :=
      (NEW.status IS NOT NULL AND lower(NEW.status) IN ('completed','answered','in-progress'))
      OR (NEW.call_duration IS NOT NULL AND NEW.call_duration > 0)
      OR (NEW.delivery_status IS NOT NULL AND lower(NEW.delivery_status) IN ('answered','completed','in_progress'));
    IF NOT v_is_answered THEN RETURN NEW; END IF;
  END IF;

  SELECT id, store_id, name
    INTO v_contact
    FROM public.store_contacts
   WHERE right(regexp_replace(coalesce(phone,''), '\D','', 'g'), 10) = v_d10
   ORDER BY is_primary DESC NULLS LAST, created_at ASC
   LIMIT 1;

  IF NOT FOUND THEN RETURN NEW; END IF;

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

  -- Backfill missing store_id on the log
  IF NEW.store_id IS NULL AND v_contact.store_id IS NOT NULL THEN
    UPDATE public.communication_logs
       SET store_id = v_contact.store_id,
           follow_up_required = false
     WHERE id = NEW.id;
  END IF;

  BEGIN
    INSERT INTO public.account_notes (entity_type, entity_id, note_type, note_body, created_by)
    VALUES ('store_contact', v_contact.id, 'responsiveness',
            'Auto-marked responsive: ' || v_channel_label || ' on ' || to_char(now(),'YYYY-MM-DD HH24:MI'),
            'system:auto');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_mark_responsive_on_inbound ON public.communication_logs;
CREATE TRIGGER trg_auto_mark_responsive_on_inbound
AFTER INSERT ON public.communication_logs
FOR EACH ROW EXECUTE FUNCTION public.auto_mark_responsive_on_inbound();

-- ─── BACKFILL ───────────────────────────────────────────────────────────────
-- 1) Re-link orphan inbound logs (store_id NULL) to a store via last-10 phone match
WITH matched AS (
  SELECT cl.id AS log_id, sc.store_id
    FROM public.communication_logs cl
    JOIN public.store_contacts sc
      ON right(regexp_replace(coalesce(sc.phone,''),'\D','','g'),10)
       = right(regexp_replace(coalesce(cl.sender_phone,''),'\D','','g'),10)
     AND length(right(regexp_replace(coalesce(cl.sender_phone,''),'\D','','g'),10)) = 10
   WHERE cl.direction = 'inbound'
     AND cl.store_id IS NULL
     AND cl.sender_phone IS NOT NULL
)
UPDATE public.communication_logs cl
   SET store_id = m.store_id,
       follow_up_required = false
  FROM matched m
 WHERE cl.id = m.log_id;

-- 2) Auto-mark responsive for historic inbound texts
WITH sms_hist AS (
  SELECT sc.id AS contact_id,
         MAX(cl.created_at) AS latest,
         COUNT(*) AS cnt
    FROM public.communication_logs cl
    JOIN public.store_contacts sc
      ON right(regexp_replace(coalesce(sc.phone,''),'\D','','g'),10)
       = right(regexp_replace(coalesce(cl.sender_phone,''),'\D','','g'),10)
     AND length(right(regexp_replace(coalesce(cl.sender_phone,''),'\D','','g'),10)) = 10
   WHERE cl.direction='inbound' AND cl.channel='sms'
   GROUP BY sc.id
)
UPDATE public.store_contacts sc
   SET responsive_by_text = true,
       last_text_received_at = GREATEST(COALESCE(sc.last_text_received_at, 'epoch'::timestamptz), h.latest),
       last_responded_at    = GREATEST(COALESCE(sc.last_responded_at,    'epoch'::timestamptz), h.latest),
       total_texts_received = GREATEST(COALESCE(sc.total_texts_received,0), h.cnt),
       responsiveness_status = 'responsive',
       responsiveness_updated_at = now()
  FROM sms_hist h
 WHERE sc.id = h.contact_id;

-- 3) Auto-mark responsive for historic answered inbound calls
WITH call_hist AS (
  SELECT sc.id AS contact_id,
         MAX(cl.created_at) AS latest,
         COUNT(*) AS cnt
    FROM public.communication_logs cl
    JOIN public.store_contacts sc
      ON right(regexp_replace(coalesce(sc.phone,''),'\D','','g'),10)
       = right(regexp_replace(coalesce(cl.sender_phone,''),'\D','','g'),10)
     AND length(right(regexp_replace(coalesce(cl.sender_phone,''),'\D','','g'),10)) = 10
   WHERE cl.direction='inbound' AND cl.channel='call'
     AND (
       (cl.call_duration IS NOT NULL AND cl.call_duration > 0)
       OR lower(coalesce(cl.status,'')) IN ('completed','answered')
       OR lower(coalesce(cl.delivery_status,'')) IN ('completed','answered')
     )
   GROUP BY sc.id
)
UPDATE public.store_contacts sc
   SET responsive_by_call = true,
       last_call_answered_at = GREATEST(COALESCE(sc.last_call_answered_at,'epoch'::timestamptz), h.latest),
       last_responded_at     = GREATEST(COALESCE(sc.last_responded_at,   'epoch'::timestamptz), h.latest),
       total_calls_answered  = GREATEST(COALESCE(sc.total_calls_answered,0), h.cnt),
       responsiveness_status = 'responsive',
       responsiveness_updated_at = now()
  FROM call_hist h
 WHERE sc.id = h.contact_id;
