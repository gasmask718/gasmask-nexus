CREATE TABLE IF NOT EXISTS public.store_archive_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  store_id uuid NOT NULL,
  store_name text,
  previous_status text,
  previous_deleted_at timestamptz,
  reason text NOT NULL,
  source_summary text,
  applied_at timestamptz,
  reverted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.store_archive_log TO authenticated;
GRANT ALL ON public.store_archive_log TO service_role;

ALTER TABLE public.store_archive_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read store archive log"
ON public.store_archive_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_sal_run ON public.store_archive_log(run_id);
CREATE INDEX IF NOT EXISTS idx_sal_store ON public.store_archive_log(store_id);

-- Guard: a brand-new store with no address, no zip and no phone is not an
-- active store. Flag it for enrichment instead of letting it inflate counts.
CREATE OR REPLACE FUNCTION public.guard_contactless_store_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NULLIF(btrim(COALESCE(NEW.address, '')), '') IS NULL
     AND NULLIF(btrim(COALESCE(NEW.zip, '')), '') IS NULL
     AND NULLIF(btrim(COALESCE(NEW.phone, '')), '') IS NULL
  THEN
    NEW.status := COALESCE(NULLIF(NEW.status, 'active'), 'needs_enrichment');
    IF NEW.status = 'active' THEN
      NEW.status := 'needs_enrichment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_contactless_store_insert ON public.store_master;
CREATE TRIGGER trg_guard_contactless_store_insert
BEFORE INSERT ON public.store_master
FOR EACH ROW EXECUTE FUNCTION public.guard_contactless_store_insert();