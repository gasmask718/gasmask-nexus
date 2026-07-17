
-- Bidirectional mirror of connected_group_id between stores <-> store_master.
-- The "value differs" guard prevents recursion between the two triggers.

CREATE OR REPLACE FUNCTION public.sync_connected_group_stores_to_master()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.store_master m
     SET connected_group_id = NEW.connected_group_id
   WHERE m.id = NEW.id
     AND m.connected_group_id IS DISTINCT FROM NEW.connected_group_id;
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
  UPDATE public.stores s
     SET connected_group_id = NEW.connected_group_id
   WHERE s.id = NEW.id
     AND s.connected_group_id IS DISTINCT FROM NEW.connected_group_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_connected_group_stores_to_master ON public.stores;
CREATE TRIGGER trg_sync_connected_group_stores_to_master
AFTER INSERT OR UPDATE OF connected_group_id ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.sync_connected_group_stores_to_master();

DROP TRIGGER IF EXISTS trg_sync_connected_group_master_to_stores ON public.store_master;
CREATE TRIGGER trg_sync_connected_group_master_to_stores
AFTER INSERT OR UPDATE OF connected_group_id ON public.store_master
FOR EACH ROW
EXECUTE FUNCTION public.sync_connected_group_master_to_stores();
