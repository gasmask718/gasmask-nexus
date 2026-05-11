CREATE OR REPLACE FUNCTION public.sync_stores_deleted_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    UPDATE public.stores
    SET deleted_at = NEW.deleted_at
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_stores_deleted_at ON public.store_master;
CREATE TRIGGER trg_sync_stores_deleted_at
AFTER UPDATE OF deleted_at ON public.store_master
FOR EACH ROW
EXECUTE FUNCTION public.sync_stores_deleted_at();