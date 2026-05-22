-- A) Extend the existing validation trigger (additive — append marketplace_direct)
CREATE OR REPLACE FUNCTION public.tt_service_routing_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.dispatch_pattern IS NOT NULL
     AND NEW.dispatch_pattern NOT IN
         ('pool_style','asset_fallback','hybrid','quote_region','broadcast_hold','marketplace_direct')
  THEN
    RAISE EXCEPTION 'Invalid dispatch_pattern %: must be one of pool_style|asset_fallback|hybrid|quote_region|broadcast_hold|marketplace_direct', NEW.dispatch_pattern;
  END IF;
  RETURN NEW;
END $function$;

-- B) Activate decor routing on marketplace_direct
UPDATE public.tt_service_routing
   SET dispatch_pattern = 'marketplace_direct',
       is_active = true
 WHERE slug IN ('hotel-decor', 'truck-decor');