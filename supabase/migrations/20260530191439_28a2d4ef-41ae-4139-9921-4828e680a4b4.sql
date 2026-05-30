-- ============================================================
-- RECENCY BACKFILL + FORWARD-FILL
-- store_master.last_order_at / last_visit_at made authoritative
-- ============================================================

-- 1. BACKFILL last_order_at from invoices ---------------------
UPDATE public.store_master sm
SET last_order_at = sub.last_inv
FROM (
  SELECT store_id, MAX(created_at) AS last_inv
  FROM public.invoices
  WHERE deleted_at IS NULL AND store_id IS NOT NULL
  GROUP BY store_id
) sub
WHERE sm.id = sub.store_id;

-- 2. BACKFILL last_visit_at from store_visits ∪ route_stops ---
UPDATE public.store_master sm
SET last_visit_at = sub.last_vis
FROM (
  SELECT store_id, MAX(ts) AS last_vis
  FROM (
    SELECT store_id, COALESCE(completed_at, started_at, created_at) AS ts
      FROM public.store_visits WHERE store_id IS NOT NULL
    UNION ALL
    SELECT store_id, COALESCE(actual_departure, actual_arrival, updated_at) AS ts
      FROM public.route_stops WHERE store_id IS NOT NULL AND actual_arrival IS NOT NULL
  ) u
  WHERE ts IS NOT NULL
  GROUP BY store_id
) sub
WHERE sm.id = sub.store_id;

-- 3. FORWARD-FILL TRIGGER FUNCTIONS ---------------------------

-- Invoices → last_order_at
CREATE OR REPLACE FUNCTION public.trg_bump_store_last_order_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.store_id IS NULL OR NEW.deleted_at IS NOT NULL OR NEW.created_at IS NULL THEN
    RETURN NEW;
  END IF;
  UPDATE public.store_master
  SET last_order_at = GREATEST(COALESCE(last_order_at, '-infinity'::timestamptz), NEW.created_at)
  WHERE id = NEW.store_id
    AND (last_order_at IS NULL OR NEW.created_at > last_order_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_bump_last_order_at ON public.invoices;
CREATE TRIGGER trg_invoices_bump_last_order_at
AFTER INSERT OR UPDATE OF created_at, deleted_at, store_id
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.trg_bump_store_last_order_at();

-- store_visits → last_visit_at
CREATE OR REPLACE FUNCTION public.trg_bump_store_last_visit_at_sv()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ts timestamptz;
BEGIN
  IF NEW.store_id IS NULL THEN RETURN NEW; END IF;
  v_ts := COALESCE(NEW.completed_at, NEW.started_at, NEW.created_at);
  IF v_ts IS NULL THEN RETURN NEW; END IF;
  UPDATE public.store_master
  SET last_visit_at = GREATEST(COALESCE(last_visit_at, '-infinity'::timestamptz), v_ts)
  WHERE id = NEW.store_id
    AND (last_visit_at IS NULL OR v_ts > last_visit_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_visits_bump_last_visit_at ON public.store_visits;
CREATE TRIGGER trg_store_visits_bump_last_visit_at
AFTER INSERT OR UPDATE ON public.store_visits
FOR EACH ROW
EXECUTE FUNCTION public.trg_bump_store_last_visit_at_sv();

-- route_stops (only when actual_arrival is set) → last_visit_at
CREATE OR REPLACE FUNCTION public.trg_bump_store_last_visit_at_rs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ts timestamptz;
BEGIN
  IF NEW.store_id IS NULL OR NEW.actual_arrival IS NULL THEN RETURN NEW; END IF;
  v_ts := COALESCE(NEW.actual_departure, NEW.actual_arrival);
  UPDATE public.store_master
  SET last_visit_at = GREATEST(COALESCE(last_visit_at, '-infinity'::timestamptz), v_ts)
  WHERE id = NEW.store_id
    AND (last_visit_at IS NULL OR v_ts > last_visit_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_route_stops_bump_last_visit_at ON public.route_stops;
CREATE TRIGGER trg_route_stops_bump_last_visit_at
AFTER INSERT OR UPDATE OF actual_arrival, actual_departure
ON public.route_stops
FOR EACH ROW
EXECUTE FUNCTION public.trg_bump_store_last_visit_at_rs();

-- field_submissions (recon/questionnaire applied) → last_visit_at
-- Bumps when is_applied flips true OR an already-applied submission is inserted.
CREATE OR REPLACE FUNCTION public.trg_bump_store_last_visit_at_fs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ts timestamptz;
BEGIN
  IF NEW.store_id IS NULL OR NEW.is_applied IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.entity_type::text NOT IN ('store_questionnaire','store_contact','sticker_change','tube_inventory','connected_store') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_applied IS TRUE THEN
    RETURN NEW; -- only bump on the transition / fresh apply
  END IF;
  v_ts := COALESCE(NEW.applied_at, NEW.submitted_at, NEW.created_at, NOW());
  UPDATE public.store_master
  SET last_visit_at = GREATEST(COALESCE(last_visit_at, '-infinity'::timestamptz), v_ts)
  WHERE id = NEW.store_id
    AND (last_visit_at IS NULL OR v_ts > last_visit_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_field_submissions_bump_last_visit_at ON public.field_submissions;
CREATE TRIGGER trg_field_submissions_bump_last_visit_at
AFTER INSERT OR UPDATE OF is_applied
ON public.field_submissions
FOR EACH ROW
EXECUTE FUNCTION public.trg_bump_store_last_visit_at_fs();
