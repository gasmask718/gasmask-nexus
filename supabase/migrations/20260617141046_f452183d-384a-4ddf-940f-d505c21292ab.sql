
-- B2.2 FIX: widen products_all status CHECK so the confirm-gate trigger can route rows
-- to 'draft' / 'pending_admin_review' without violating the constraint.
ALTER TABLE public.products_all DROP CONSTRAINT IF EXISTS products_all_status_check;
ALTER TABLE public.products_all ADD CONSTRAINT products_all_status_check
  CHECK (status = ANY (ARRAY['active','inactive','deleted','draft','pending_admin_review']));

-- B2.3 FIX (a): flip the Phase-2 self-serve flag OFF (spec: wholesalers must be gated to review).
UPDATE public.dd_config SET wholesaler_self_serve_enabled = false, updated_at = now() WHERE id = true;

-- B2.3 FIX (b): make the self-serve review trigger actually consult dd_config.
-- When the flag is FALSE, every non-admin publish/active transition is forced to pending_admin_review.
-- When the flag is TRUE, non-admins may publish directly (still subject to the catalog confirm gate).
CREATE OR REPLACE FUNCTION public.dd_enforce_self_serve_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean := false;
  v_self_serve_enabled boolean := false;
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    v_is_admin := has_role(NEW.created_by, 'admin'::app_role)
               OR has_role(NEW.created_by, 'owner'::app_role);
  END IF;

  SELECT COALESCE(wholesaler_self_serve_enabled, false)
    INTO v_self_serve_enabled
  FROM public.dd_config
  WHERE id = true;

  IF NOT v_is_admin
     AND NOT v_self_serve_enabled
     AND NEW.status IN ('published', 'active')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.status := 'pending_admin_review';
  END IF;

  RETURN NEW;
END;
$function$;
