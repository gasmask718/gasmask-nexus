-- STOP routing defect fix.
-- handle_sms_opt_out only updated store_contacts (exact phone match), so the
-- suppression tables read by _shared/dnc.ts::isSuppressed() were never written.

CREATE OR REPLACE FUNCTION public.normalize_phone_e164(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_phone IS NULL THEN NULL
    WHEN length(regexp_replace(p_phone, '\D', '', 'g')) = 0 THEN NULL
    WHEN length(regexp_replace(p_phone, '\D', '', 'g')) = 10
      THEN '+1' || regexp_replace(p_phone, '\D', '', 'g')
    ELSE '+' || regexp_replace(p_phone, '\D', '', 'g')
  END
$function$;

CREATE OR REPLACE FUNCTION public.handle_sms_opt_out(p_phone text, p_method text DEFAULT 'STOP_keyword'::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contact_id uuid;
  v_e164 text;
  v_last10 text;
BEGIN
  v_e164 := public.normalize_phone_e164(p_phone);
  IF v_e164 IS NULL THEN
    RAISE EXCEPTION 'handle_sms_opt_out: unparseable phone %', p_phone;
  END IF;
  v_last10 := right(regexp_replace(v_e164, '\D', '', 'g'), 10);

  -- 1) SUPPRESSION IS UNCONDITIONAL. These two tables are what isSuppressed()
  --    reads; they must be written whether or not the sender is known to us.
  INSERT INTO public.opt_out_events (phone_number, source, reason)
  VALUES (v_e164, 'sms_inbound', p_method)
  ON CONFLICT (phone_number) DO UPDATE
    SET source = EXCLUDED.source,
        reason = EXCLUDED.reason,
        created_at = now();

  INSERT INTO public.dnc_list (phone_number, phone_e164, source, reason)
  VALUES (v_e164, v_e164, 'sms_inbound', p_method)
  ON CONFLICT (phone_number) DO UPDATE
    SET phone_e164 = EXCLUDED.phone_e164,
        source = EXCLUDED.source,
        reason = EXCLUDED.reason;

  -- 2) CRM view stays accurate, but is now a best-effort side effect matched on
  --    the last 10 digits (contacts are stored in mixed formats). It no longer
  --    gates suppression.
  UPDATE store_contacts
  SET opted_out = true,
      opted_out_at = now(),
      opted_out_method = p_method
  WHERE right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = v_last10
    AND v_last10 <> ''
  RETURNING id INTO v_contact_id;

  RETURN v_contact_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_sms_opt_in(p_phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contact_id uuid;
  v_e164 text;
  v_digits text;
  v_last10 text;
BEGIN
  v_e164 := public.normalize_phone_e164(p_phone);
  IF v_e164 IS NULL THEN
    RAISE EXCEPTION 'handle_sms_opt_in: unparseable phone %', p_phone;
  END IF;
  v_digits := regexp_replace(v_e164, '\D', '', 'g');
  v_last10 := right(v_digits, 10);

  -- START must actually lift suppression, otherwise the gate never releases.
  -- Only rows we created from an inbound SMS are cleared; manual/regulatory
  -- DNC entries (any other source) are left alone.
  DELETE FROM public.opt_out_events
   WHERE phone_number IN (v_e164, v_digits, p_phone);

  DELETE FROM public.dnc_list
   WHERE (phone_number IN (v_e164, v_digits, p_phone)
          OR phone_e164 IN (v_e164, v_digits))
     AND coalesce(source, '') = 'sms_inbound';

  UPDATE store_contacts
  SET opted_out = false,
      opted_out_at = NULL,
      opted_out_method = NULL
  WHERE right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10) = v_last10
    AND v_last10 <> ''
  RETURNING id INTO v_contact_id;

  RETURN v_contact_id;
END;
$function$;