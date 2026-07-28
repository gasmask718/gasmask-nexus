DROP TRIGGER IF EXISTS update_contact_last_communication_trigger ON public.communication_logs;
DROP FUNCTION IF EXISTS public.update_contact_last_communication();