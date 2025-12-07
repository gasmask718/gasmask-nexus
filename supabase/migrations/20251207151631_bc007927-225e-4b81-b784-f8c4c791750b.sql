-- Add address and neighborhood fields to crm_contacts table
ALTER TABLE public.crm_contacts 
ADD COLUMN IF NOT EXISTS address_street text,
ADD COLUMN IF NOT EXISTS address_city text,
ADD COLUMN IF NOT EXISTS address_state text,
ADD COLUMN IF NOT EXISTS address_zip text,
ADD COLUMN IF NOT EXISTS neighborhood_id uuid REFERENCES public.neighborhoods(id);

-- Create index for neighborhood lookups
CREATE INDEX IF NOT EXISTS idx_crm_contacts_neighborhood_id ON public.crm_contacts(neighborhood_id);