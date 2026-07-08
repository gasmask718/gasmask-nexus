CREATE OR REPLACE FUNCTION public.generate_clipper_tracking_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_business text;
  v_code text;
BEGIN
  SELECT dynasty_business INTO v_business
  FROM public.clipper_campaigns
  WHERE id = NEW.campaign_id;

  v_code := encode(extensions.gen_random_bytes(4), 'hex');

  NEW.tracking_link :=
    'https://dynastyclipper.io/go/' || COALESCE(v_business, 'unknown') || '/' || v_code;

  RETURN NEW;
END;
$function$;