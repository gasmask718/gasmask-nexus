CREATE OR REPLACE FUNCTION public.soft_delete_contact(contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE crm_contacts
  SET deleted_at = now()
  WHERE id = contact_id;
END;
$$;