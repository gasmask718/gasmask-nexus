
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'production';

CREATE OR REPLACE FUNCTION public.create_invite(p_role app_role, p_target_link jsonb DEFAULT '{}'::jsonb, p_phone text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_name text DEFAULT NULL::text, p_channel text DEFAULT 'sms'::text)
 RETURNS invites
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_row public.invites;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  IF NOT (
    public.has_role(auth.uid(), 'owner'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_elevated_user(auth.uid())
  ) THEN
    RAISE EXCEPTION 'not authorized to create invites';
  END IF;

  IF p_role::text NOT IN ('wholesaler','ambassador','store','customer','va','driver','biker','production') THEN
    RAISE EXCEPTION 'role % is not invitable', p_role;
  END IF;

  INSERT INTO public.invites (role, target_link, invited_by, channel, sent_to_phone, sent_to_email, sent_name)
  VALUES (p_role, COALESCE(p_target_link,'{}'::jsonb), auth.uid(), COALESCE(p_channel,'sms'), p_phone, p_email, p_name)
  RETURNING * INTO v_row;
  RETURN v_row;
END $function$;
