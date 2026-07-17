
-- ═══════════════════════════════════════════════════════════════════════════
-- Connected Group ID sync: keep stores.connected_group_id and
-- store_master.connected_group_id in lockstep. Match rows by shared id
-- (the two tables typically share id via the resolver RPC).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_connected_group_stores_to_master()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.connected_group_id IS DISTINCT FROM OLD.connected_group_id THEN
    UPDATE public.store_master
       SET connected_group_id = NEW.connected_group_id
     WHERE id = NEW.id
       AND connected_group_id IS DISTINCT FROM NEW.connected_group_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_connected_group_master_to_stores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.connected_group_id IS DISTINCT FROM OLD.connected_group_id THEN
    UPDATE public.stores
       SET connected_group_id = NEW.connected_group_id
     WHERE id = NEW.id
       AND connected_group_id IS DISTINCT FROM NEW.connected_group_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_connected_group_stores_to_master ON public.stores;
CREATE TRIGGER trg_sync_connected_group_stores_to_master
AFTER UPDATE OF connected_group_id ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.sync_connected_group_stores_to_master();

DROP TRIGGER IF EXISTS trg_sync_connected_group_master_to_stores ON public.store_master;
CREATE TRIGGER trg_sync_connected_group_master_to_stores
AFTER UPDATE OF connected_group_id ON public.store_master
FOR EACH ROW EXECUTE FUNCTION public.sync_connected_group_master_to_stores();

-- Also handle INSERT so newly-created stores with a group_id propagate.
CREATE OR REPLACE FUNCTION public.sync_connected_group_stores_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.connected_group_id IS NOT NULL THEN
    UPDATE public.store_master
       SET connected_group_id = NEW.connected_group_id
     WHERE id = NEW.id
       AND connected_group_id IS DISTINCT FROM NEW.connected_group_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_connected_group_stores_insert ON public.stores;
CREATE TRIGGER trg_sync_connected_group_stores_insert
AFTER INSERT ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.sync_connected_group_stores_insert();

-- Backfill: propagate any existing stores.connected_group_id onto store_master (id match).
UPDATE public.store_master sm
   SET connected_group_id = s.connected_group_id
  FROM public.stores s
 WHERE sm.id = s.id
   AND s.connected_group_id IS NOT NULL
   AND sm.connected_group_id IS DISTINCT FROM s.connected_group_id;

-- Reverse backfill: propagate any store_master.connected_group_id onto stores (id match).
UPDATE public.stores s
   SET connected_group_id = sm.connected_group_id
  FROM public.store_master sm
 WHERE sm.id = s.id
   AND sm.connected_group_id IS NOT NULL
   AND s.connected_group_id IS DISTINCT FROM sm.connected_group_id;
