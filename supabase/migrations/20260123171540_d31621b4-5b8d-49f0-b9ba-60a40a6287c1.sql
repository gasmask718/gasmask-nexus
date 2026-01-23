-- Drop the old audit trigger on stores that uses the outdated audit_trigger function
DROP TRIGGER IF EXISTS audit_stores ON public.stores;

-- Create new audit trigger using the updated trg_audit_generic function that computes row_hash
CREATE TRIGGER audit_stores
  AFTER INSERT OR UPDATE OR DELETE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_generic();