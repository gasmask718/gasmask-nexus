-- Add role_id column to crm_contacts if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'crm_contacts' 
    AND column_name = 'role_id'
  ) THEN
    ALTER TABLE public.crm_contacts 
    ADD COLUMN role_id UUID REFERENCES public.customer_roles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_crm_contacts_role_id ON public.crm_contacts(role_id);