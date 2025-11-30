-- DYNASTY OS - Phase 2b: Audit Triggers on Critical Tables

-- Attach audit trigger to critical tables
DROP TRIGGER IF EXISTS audit_orders ON public.orders;
CREATE TRIGGER audit_orders
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_crm_contacts ON public.crm_contacts;
CREATE TRIGGER audit_crm_contacts
AFTER INSERT OR UPDATE OR DELETE ON public.crm_contacts
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_stores ON public.stores;
CREATE TRIGGER audit_stores
AFTER INSERT OR UPDATE OR DELETE ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_wholesalers ON public.wholesalers;
CREATE TRIGGER audit_wholesalers
AFTER INSERT OR UPDATE OR DELETE ON public.wholesalers
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS audit_system_checkpoints ON public.system_checkpoints;
CREATE TRIGGER audit_system_checkpoints
AFTER INSERT OR UPDATE OR DELETE ON public.system_checkpoints
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();