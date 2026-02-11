
-- Protect created_by from being changed after INSERT on wholesaler_assignments
CREATE OR REPLACE FUNCTION public.protect_created_by_wholesaler_assignments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by is immutable and cannot be changed after creation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_created_by_wholesaler_assignments
  BEFORE UPDATE ON public.wholesaler_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_created_by_wholesaler_assignments();
