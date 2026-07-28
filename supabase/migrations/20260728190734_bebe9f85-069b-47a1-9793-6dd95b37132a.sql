
ALTER TABLE public.store_tube_inventory
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.store_tube_inventory_status
  ADD COLUMN IF NOT EXISTS tubes_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_inventory_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_inventory_check_by uuid;

ALTER TABLE public.store_contacts
  ADD COLUMN IF NOT EXISTS phone_note text;

UPDATE public.store_tube_inventory_status
  SET tubes_updated_at = COALESCE(tubes_updated_at, last_updated_at),
      last_inventory_check_at = COALESCE(last_inventory_check_at, last_updated_at)
  WHERE tubes_updated_at IS NULL OR last_inventory_check_at IS NULL;

CREATE OR REPLACE FUNCTION public.touch_store_tube_inventory_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.last_checked_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.last_updated := now();
  ELSIF NEW.current_tubes_left IS DISTINCT FROM OLD.current_tubes_left THEN
    NEW.last_updated := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_store_tube_inventory_timestamps ON public.store_tube_inventory;
CREATE TRIGGER trg_touch_store_tube_inventory_timestamps
  BEFORE INSERT OR UPDATE ON public.store_tube_inventory
  FOR EACH ROW EXECUTE FUNCTION public.touch_store_tube_inventory_timestamps();

CREATE OR REPLACE FUNCTION public.touch_store_tube_status_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.last_inventory_check_at := now();
  IF TG_OP = 'INSERT' THEN
    NEW.tubes_updated_at := COALESCE(NEW.tubes_updated_at, now());
  ELSIF NEW.current_tubes_left IS DISTINCT FROM OLD.current_tubes_left THEN
    NEW.tubes_updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_store_tube_status_timestamps ON public.store_tube_inventory_status;
CREATE TRIGGER trg_touch_store_tube_status_timestamps
  BEFORE INSERT OR UPDATE ON public.store_tube_inventory_status
  FOR EACH ROW EXECUTE FUNCTION public.touch_store_tube_status_timestamps();
