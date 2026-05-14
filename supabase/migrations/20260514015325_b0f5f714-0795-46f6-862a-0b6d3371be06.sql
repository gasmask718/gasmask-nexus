CREATE OR REPLACE FUNCTION public.handle_sms_opt_out(
  p_phone text,
  p_method text DEFAULT 'STOP_keyword'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
BEGIN
  UPDATE store_contacts
  SET opted_out = true,
      opted_out_at = now(),
      opted_out_method = p_method
  WHERE phone = p_phone
  RETURNING id INTO v_contact_id;
  RETURN v_contact_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_sms_opt_in(
  p_phone text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
BEGIN
  UPDATE store_contacts
  SET opted_out = false,
      opted_out_at = NULL,
      opted_out_method = NULL
  WHERE phone = p_phone
  RETURNING id INTO v_contact_id;
  RETURN v_contact_id;
END;
$$;