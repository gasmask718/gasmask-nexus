
-- ═══════════════════════════════════════════════════════════════════════════════
-- DURABLE FIX: Collapse legacy 'grabba' brand_id into canonical 'grabba_r_us'.
-- 1) Merge 66 store_tube_inventory_status rows where canonical counterpart exists
-- 2) Rename 106 store_tube_inventory_status rows where no counterpart exists
-- 3) Normalize 3 store_tube_inventory rows ('grabba' -> 'grabba_r_us')
-- 4) Install normalization trigger on store_tube_inventory_status so legacy
--    aliases can never be inserted/updated again.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1) MERGE: legacy 'grabba' rows where a 'grabba_r_us' counterpart exists ──
WITH legacy AS (
  SELECT * FROM public.store_tube_inventory_status WHERE brand_id = 'grabba'
)
UPDATE public.store_tube_inventory_status c
SET
  current_tubes_left   = COALESCE(c.current_tubes_left, 0) + COALESCE(l.current_tubes_left, 0),
  last_order_date      = GREATEST(c.last_order_date, l.last_order_date),
  needs_order          = COALESCE(c.needs_order, false) OR COALESCE(l.needs_order, false),
  bring_samples        = COALESCE(c.bring_samples, false) OR COALESCE(l.bring_samples, false),
  bring_starter_kit    = COALESCE(c.bring_starter_kit, false) OR COALESCE(l.bring_starter_kit, false),
  owner_interested     = COALESCE(c.owner_interested, l.owner_interested),
  has_ever_ordered     = COALESCE(c.has_ever_ordered, false) OR COALESCE(l.has_ever_ordered, false),
  starter_kit_delivered= COALESCE(c.starter_kit_delivered, false) OR COALESCE(l.starter_kit_delivered, false),
  product_introduced   = COALESCE(c.product_introduced, false) OR COALESCE(l.product_introduced, false),
  needs_switch         = COALESCE(c.needs_switch, false) OR COALESCE(l.needs_switch, false),
  switch_quantity      = COALESCE(c.switch_quantity, l.switch_quantity),
  switch_notes         = COALESCE(c.switch_notes, l.switch_notes),
  switch_flagged_at    = GREATEST(c.switch_flagged_at, l.switch_flagged_at),
  switch_flagged_by    = COALESCE(c.switch_flagged_by, l.switch_flagged_by),
  last_updated_at      = GREATEST(c.last_updated_at, l.last_updated_at),
  last_updated_by      = COALESCE(
                           CASE WHEN c.last_updated_at >= COALESCE(l.last_updated_at, 'epoch'::timestamptz)
                                THEN c.last_updated_by ELSE l.last_updated_by END,
                           c.last_updated_by, l.last_updated_by),
  last_updated_by_role = COALESCE(
                           CASE WHEN c.last_updated_at >= COALESCE(l.last_updated_at, 'epoch'::timestamptz)
                                THEN c.last_updated_by_role ELSE l.last_updated_by_role END,
                           c.last_updated_by_role, l.last_updated_by_role),
  last_updated_method  = COALESCE(
                           CASE WHEN c.last_updated_at >= COALESCE(l.last_updated_at, 'epoch'::timestamptz)
                                THEN c.last_updated_method ELSE l.last_updated_method END,
                           c.last_updated_method, l.last_updated_method),
  brand_name           = 'Grabba R Us'
FROM legacy l
WHERE c.brand_id = 'grabba_r_us'
  AND c.store_id = l.store_id
  AND c.is_simulation = l.is_simulation;

-- Drop the legacy rows whose flags we just merged in
DELETE FROM public.store_tube_inventory_status l
WHERE l.brand_id = 'grabba'
  AND EXISTS (
    SELECT 1 FROM public.store_tube_inventory_status c
    WHERE c.brand_id = 'grabba_r_us'
      AND c.store_id = l.store_id
      AND c.is_simulation = l.is_simulation
  );

-- ─── 2) RENAME: remaining 'grabba' rows have no counterpart, just rekey ──────
UPDATE public.store_tube_inventory_status
SET brand_id = 'grabba_r_us',
    brand_name = 'Grabba R Us'
WHERE brand_id = 'grabba';

-- ─── 3) NORMALIZE store_tube_inventory raw brand values ─────────────────────
-- Sum tubes if the store already has a canonical row, otherwise rename.
WITH legacy AS (
  SELECT id, store_id, current_tubes_left, last_updated
  FROM public.store_tube_inventory
  WHERE lower(brand) = 'grabba'
)
UPDATE public.store_tube_inventory c
SET current_tubes_left = COALESCE(c.current_tubes_left, 0) + COALESCE(l.current_tubes_left, 0),
    last_updated = GREATEST(c.last_updated, l.last_updated)
FROM legacy l
WHERE c.store_id = l.store_id
  AND lower(c.brand) = 'grabba_r_us';

DELETE FROM public.store_tube_inventory l
WHERE lower(l.brand) = 'grabba'
  AND EXISTS (
    SELECT 1 FROM public.store_tube_inventory c
    WHERE c.store_id = l.store_id AND lower(c.brand) = 'grabba_r_us'
  );

UPDATE public.store_tube_inventory
SET brand = 'grabba_r_us'
WHERE lower(brand) = 'grabba';

-- ─── 4) Trigger: normalize legacy aliases on every write ────────────────────
CREATE OR REPLACE FUNCTION public.normalize_brand_id_grabba()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.brand_id IS NOT NULL AND lower(NEW.brand_id) IN ('grabba','grabbarus','grabba r us') THEN
    NEW.brand_id := 'grabba_r_us';
    IF NEW.brand_name IS NULL OR lower(NEW.brand_name) IN ('grabba','grabbarus','grabba r us') THEN
      NEW.brand_name := 'Grabba R Us';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_brand_id_grabba ON public.store_tube_inventory_status;
CREATE TRIGGER trg_normalize_brand_id_grabba
BEFORE INSERT OR UPDATE ON public.store_tube_inventory_status
FOR EACH ROW EXECUTE FUNCTION public.normalize_brand_id_grabba();
