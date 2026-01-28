-- Fix: Replace audit_trigger with trg_audit_generic on wholesalers table
-- The old audit_trigger() does NOT compute row_hash, causing NOT NULL violations

-- Drop the old trigger using the legacy function
DROP TRIGGER IF EXISTS audit_wholesalers ON public.wholesalers;

-- Create new trigger using the updated trg_audit_generic that computes row_hash
CREATE TRIGGER audit_wholesalers
  AFTER INSERT OR UPDATE OR DELETE ON public.wholesalers
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_generic();