ALTER TABLE public.dd_config
  ADD COLUMN IF NOT EXISTS wholesaler_self_serve_enabled boolean NOT NULL DEFAULT false;

-- Self-serve draft status enum guard: drafts submitted by non-admins must be marked
-- 'pending_admin_review' instead of going directly to 'published'. This trigger enforces it.
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

  -- Block direct publish by non-admins. Force review stage.
  IF NOT v_is_admin
     AND NEW.status = 'published'
     AND (OLD.status IS DISTINCT FROM 'published') THEN
    NEW.status := 'pending_admin_review';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dd_drafts_self_serve_review ON public.dd_catalog_drafts;
CREATE TRIGGER trg_dd_drafts_self_serve_review
BEFORE UPDATE OF status ON public.dd_catalog_drafts
FOR EACH ROW EXECUTE FUNCTION public.dd_enforce_self_serve_review();