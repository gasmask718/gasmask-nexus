
CREATE OR REPLACE FUNCTION public.check_store_not_ambassador()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.store_name IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ambassadors
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(NEW.store_name))
  ) THEN
    RAISE EXCEPTION 'store_master.store_name "%" matches an existing ambassador. Ambassadors belong in the ambassadors table, not store_master.', NEW.store_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_ambassador_as_store ON public.store_master;
CREATE TRIGGER prevent_ambassador_as_store
BEFORE INSERT OR UPDATE OF store_name ON public.store_master
FOR EACH ROW EXECUTE FUNCTION public.check_store_not_ambassador();

COMMENT ON TABLE public.store_master IS
  'Retail stores supervised by ambassadors. Never insert ambassador records here — they belong in the ambassadors table. Use ambassador_assignments to link the two.';
