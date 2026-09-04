
-- 1. Structured triage fields on the record the AI already writes.
ALTER TABLE public.inbound_call_outcomes
  ADD COLUMN IF NOT EXISTS reason_category   text,
  ADD COLUMN IF NOT EXISTS requested_action  text,
  ADD COLUMN IF NOT EXISTS urgency           text,
  ADD COLUMN IF NOT EXISTS callback_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_resolved       boolean,
  ADD COLUMN IF NOT EXISTS unresolved_reason text,
  ADD COLUMN IF NOT EXISTS caller_phone      text,
  ADD COLUMN IF NOT EXISTS contact_name      text;

-- 2. Shared writer into the EXISTING notification system (public.notifications).
CREATE OR REPLACE FUNCTION public.notify_owners(
  _type text,
  _title text,
  _message text,
  _entity_type text,
  _entity_id uuid,
  _action_url text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
BEGIN
  -- Never duplicate the same alert for the same underlying record.
  IF _entity_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.notifications
    WHERE type = _type AND entity_id = _entity_id
  ) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, entity_type, entity_id, action_url)
  SELECT DISTINCT ur.user_id, _type, _title, _message, _entity_type, _entity_id, _action_url
  FROM public.user_roles ur
  WHERE ur.role IN ('owner'::app_role, 'admin'::app_role);

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_owners(text,text,text,text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_owners(text,text,text,text,uuid,text) TO service_role;

-- 3. Callback needed after an AI-answered call.
CREATE OR REPLACE FUNCTION public.tg_notify_callback_needed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  needs boolean;
  store_name text;
  msg text;
BEGIN
  needs := NEW.callback_requested
        OR COALESCE(NEW.ai_resolved, false) = false
        OR NEW.kind IN ('callback_request', 'message');

  IF NOT needs THEN
    RETURN NEW; -- fully resolved by AI: no callback noise, call still lives in history
  END IF;

  SELECT sm.store_name INTO store_name FROM public.store_master sm WHERE sm.id = NEW.store_id;

  msg := concat_ws(' · ',
    NULLIF(concat_ws(' — ', NEW.contact_name, COALESCE(store_name, 'Account not resolved')), ''),
    NULLIF(NEW.caller_phone, ''),
    NULLIF(NEW.reason_category, ''),
    NULLIF(NEW.summary, ''),
    CASE WHEN NEW.callback_requested THEN 'Callback requested' ELSE 'Answered by AI — unresolved' END,
    NULLIF('Urgency: ' || NEW.urgency, 'Urgency: '),
    NULLIF(NEW.unresolved_reason, '')
  );

  PERFORM public.notify_owners(
    'callback_needed',
    'Call back: ' || COALESCE(NEW.contact_name, store_name, NEW.caller_phone, 'Unknown caller'),
    msg,
    'store',
    NEW.id,
    CASE WHEN NEW.store_id IS NOT NULL THEN '/stores/' || NEW.store_id::text ELSE '/communication/phone-log' END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_callback_needed ON public.inbound_call_outcomes;
CREATE TRIGGER trg_notify_callback_needed
AFTER INSERT ON public.inbound_call_outcomes
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_callback_needed();

-- 4. Missed / unanswered inbound call that no human handled.
CREATE OR REPLACE FUNCTION public.tg_notify_missed_inbound_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  store_name text;
BEGIN
  IF COALESCE(NEW.direction, '') <> 'inbound' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.channel, '') NOT IN ('call', 'voice', 'phone') THEN RETURN NEW; END IF;
  IF NEW.handled_at IS NOT NULL THEN RETURN NEW; END IF;
  IF lower(COALESCE(NEW.status, NEW.outcome, '')) NOT IN
     ('no-answer','no_answer','missed','busy','failed','canceled','cancelled','voicemail') THEN
    RETURN NEW;
  END IF;

  SELECT sm.store_name INTO store_name FROM public.store_master sm WHERE sm.id = NEW.store_id;

  PERFORM public.notify_owners(
    'missed_inbound_call',
    'Missed call: ' || COALESCE(store_name, NEW.sender_phone, 'Unknown caller'),
    concat_ws(' · ',
      COALESCE(store_name, 'Account not resolved'),
      NULLIF(NEW.sender_phone, ''),
      'Nobody answered',
      NULLIF(NEW.summary, '')
    ),
    'store',
    NEW.id,
    CASE WHEN NEW.store_id IS NOT NULL THEN '/stores/' || NEW.store_id::text ELSE '/communication/phone-log' END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_missed_inbound_call ON public.communication_logs;
CREATE TRIGGER trg_notify_missed_inbound_call
AFTER INSERT OR UPDATE OF status, outcome ON public.communication_logs
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_missed_inbound_call();
