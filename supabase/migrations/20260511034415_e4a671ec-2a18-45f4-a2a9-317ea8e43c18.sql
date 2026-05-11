-- Step 3: Auto-sync trigger for legacy stores.primary_contact_name
CREATE OR REPLACE FUNCTION public.sync_store_primary_contact_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.stores
    SET primary_contact_name = NEW.name
    WHERE id = NEW.store_id;

    UPDATE public.store_contacts
    SET is_primary = false
    WHERE store_id = NEW.store_id
      AND id != NEW.id
      AND is_primary = true;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_primary = true AND NEW.is_primary = false THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.store_contacts
      WHERE store_id = NEW.store_id
        AND is_primary = true
        AND id != NEW.id
    ) THEN
      UPDATE public.stores
      SET primary_contact_name = NULL
      WHERE id = NEW.store_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_store_primary_contact_name ON public.store_contacts;
CREATE TRIGGER trg_sync_store_primary_contact_name
AFTER INSERT OR UPDATE OF is_primary, name ON public.store_contacts
FOR EACH ROW
EXECUTE FUNCTION public.sync_store_primary_contact_name();

-- One-shot dedup: if any store has multiple is_primary=true, keep most recent only
WITH primaries AS (
  SELECT id, store_id,
    ROW_NUMBER() OVER (
      PARTITION BY store_id
      ORDER BY COALESCE(verified_at, last_responded_at, created_at) DESC NULLS LAST,
               created_at DESC
    ) AS rn
  FROM public.store_contacts
  WHERE is_primary = true
)
UPDATE public.store_contacts sc
SET is_primary = false
FROM primaries p
WHERE sc.id = p.id AND p.rn > 1;

-- One-shot backfill: sync stores.primary_contact_name from canonical primary contact
UPDATE public.stores s
SET primary_contact_name = sc.name
FROM public.store_contacts sc
WHERE sc.store_id = s.id
  AND sc.is_primary = true
  AND (s.primary_contact_name IS NULL OR s.primary_contact_name <> sc.name);