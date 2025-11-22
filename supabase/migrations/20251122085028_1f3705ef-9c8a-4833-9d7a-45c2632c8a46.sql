-- Fix function search paths for security (proper order)

DROP TRIGGER IF EXISTS update_contact_last_communication_trigger ON public.communication_logs;
DROP FUNCTION IF EXISTS update_contact_last_communication() CASCADE;
DROP FUNCTION IF EXISTS update_relationship_status();

CREATE OR REPLACE FUNCTION update_contact_last_communication()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    UPDATE public.crm_contacts
    SET last_contact_date = NEW.created_at,
        updated_at = now()
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_contact_last_communication_trigger
  AFTER INSERT ON public.communication_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_last_communication();

CREATE OR REPLACE FUNCTION update_relationship_status()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.crm_contacts
  SET relationship_status = 'cold',
      updated_at = now()
  WHERE relationship_status = 'active'
    AND last_contact_date < (now() - interval '30 days');
  
  UPDATE public.crm_contacts
  SET relationship_status = 'lost',
      updated_at = now()
  WHERE relationship_status IN ('active', 'warm', 'cold')
    AND last_contact_date < (now() - interval '60 days');
    
  UPDATE public.crm_contacts
  SET relationship_status = 'active',
      updated_at = now()
  WHERE relationship_status != 'active'
    AND last_contact_date > (now() - interval '7 days');
END;
$$;