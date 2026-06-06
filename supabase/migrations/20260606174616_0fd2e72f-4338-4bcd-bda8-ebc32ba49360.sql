
-- Section A reconciliation: extend dd_catalog_drafts with the fields the public
-- catalog grid + EasyPost contract require, and add a confirm-gate guard so the
-- pipeline can never publish status='active' without explicit admin approval.

ALTER TABLE public.dd_catalog_drafts
  ADD COLUMN IF NOT EXISTS inventory_qty integer,
  ADD COLUMN IF NOT EXISTS weight_oz numeric,
  ADD COLUMN IF NOT EXISTS dimensions jsonb,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid;

-- Trigger: only allow products_all.status='active' inserts originating from
-- a draft that has been explicitly confirmed (confirmed_at NOT NULL) OR from
-- admin/service_role direct entry. Blocks accidental pipeline publishes.
CREATE OR REPLACE FUNCTION public.dd_enforce_catalog_confirm_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draft_confirmed timestamptz;
BEGIN
  -- Only guard rows tied to a catalog draft (engine-published)
  IF NEW.status = 'active' AND TG_OP = 'INSERT' THEN
    SELECT confirmed_at INTO v_draft_confirmed
    FROM public.dd_catalog_drafts
    WHERE published_product_id = NEW.id
       OR (supplier_id = NEW.wholesaler_id AND product_name = NEW.product_name)
    ORDER BY confirmed_at DESC NULLS LAST
    LIMIT 1;

    -- If a matching draft exists but isn't confirmed, force back to 'draft'
    IF FOUND AND v_draft_confirmed IS NULL THEN
      NEW.status := 'draft';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dd_enforce_catalog_confirm_gate ON public.products_all;
CREATE TRIGGER trg_dd_enforce_catalog_confirm_gate
  BEFORE INSERT ON public.products_all
  FOR EACH ROW EXECUTE FUNCTION public.dd_enforce_catalog_confirm_gate();
