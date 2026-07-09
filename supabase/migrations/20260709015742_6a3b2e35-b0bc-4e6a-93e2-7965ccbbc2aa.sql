
-- 1) Fix broken permissions (policy was correct, grants were missing)
GRANT INSERT ON public.uben_ambassador_applications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uben_ambassador_applications TO authenticated;
GRANT ALL ON public.uben_ambassador_applications TO service_role;

-- 2) Add missing columns the UBEN public contact/apply form sends
ALTER TABLE public.uben_ambassador_applications
  ADD COLUMN IF NOT EXISTS program_interest TEXT,
  ADD COLUMN IF NOT EXISTS message          TEXT,
  ADD COLUMN IF NOT EXISTS source           TEXT,
  ADD COLUMN IF NOT EXISTS status           TEXT;

-- Keep `status` and `application_status` in lockstep so the OS reader
-- (which reads application_status) sees whatever the form writes to either.
CREATE OR REPLACE FUNCTION public.uben_app_sync_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS NOT NULL AND (NEW.application_status IS NULL OR NEW.application_status = 'applied') THEN
      NEW.application_status := NEW.status;
    END IF;
    IF NEW.status IS NULL THEN
      NEW.status := NEW.application_status;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.application_status := NEW.status;
    ELSIF NEW.application_status IS DISTINCT FROM OLD.application_status THEN
      NEW.status := NEW.application_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uben_app_sync_status ON public.uben_ambassador_applications;
CREATE TRIGGER trg_uben_app_sync_status
  BEFORE INSERT OR UPDATE ON public.uben_ambassador_applications
  FOR EACH ROW EXECUTE FUNCTION public.uben_app_sync_status();
