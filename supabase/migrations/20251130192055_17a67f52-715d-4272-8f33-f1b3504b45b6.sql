-- Add owner_id column to crm_contacts
ALTER TABLE public.crm_contacts 
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_crm_contacts_owner_id ON public.crm_contacts(owner_id);

-- Create policy for own data access
CREATE POLICY "Own data only"
ON public.crm_contacts
FOR SELECT
USING (auth.uid() = owner_id);