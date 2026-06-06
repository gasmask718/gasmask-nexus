-- 1) Flip the Phase 2 flag ON
UPDATE public.dd_config SET wholesaler_self_serve_enabled = true, updated_at = now() WHERE id = true;

-- 2) Harden products_all confirm gate: non-admin draft owners cannot land as 'active'
CREATE OR REPLACE FUNCTION public.dd_enforce_catalog_confirm_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_draft_confirmed timestamptz;
  v_draft_owner uuid;
  v_is_admin boolean := false;
BEGIN
  IF NEW.status = 'active' AND TG_OP = 'INSERT' THEN
    SELECT confirmed_at, created_by INTO v_draft_confirmed, v_draft_owner
    FROM public.dd_catalog_drafts
    WHERE published_product_id = NEW.id
       OR (supplier_id = NEW.wholesaler_id AND product_name = NEW.product_name)
    ORDER BY confirmed_at DESC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      IF v_draft_confirmed IS NULL THEN
        NEW.status := 'draft';
      ELSIF v_draft_owner IS NOT NULL THEN
        v_is_admin := has_role(v_draft_owner, 'admin'::app_role)
                   OR has_role(v_draft_owner, 'owner'::app_role);
        IF NOT v_is_admin THEN
          -- Wholesaler self-serve cannot bypass David's review queue.
          NEW.status := 'pending_admin_review';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Strengthen draft trigger: also fire on INSERT, also catch direct 'active' attempts
CREATE OR REPLACE FUNCTION public.dd_enforce_self_serve_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := false;
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    v_is_admin := has_role(NEW.created_by, 'admin'::app_role)
               OR has_role(NEW.created_by, 'owner'::app_role);
  END IF;

  IF NOT v_is_admin
     AND NEW.status IN ('published', 'active')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.status := 'pending_admin_review';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dd_drafts_self_serve_review ON public.dd_catalog_drafts;
CREATE TRIGGER trg_dd_drafts_self_serve_review
BEFORE INSERT OR UPDATE OF status ON public.dd_catalog_drafts
FOR EACH ROW EXECUTE FUNCTION public.dd_enforce_self_serve_review();