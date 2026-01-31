-- Fix change_list_items.entity_id to accept both UUIDs and string identifiers
ALTER TABLE public.change_list_items 
ALTER COLUMN entity_id TYPE text USING entity_id::text;

-- Add shirt_size column to store_contacts for contact-based clothing size
ALTER TABLE public.store_contacts 
ADD COLUMN IF NOT EXISTS shirt_size text;

-- Create store_wholesaler_contacts table for contact-based wholesaler tracking
CREATE TABLE IF NOT EXISTS public.store_wholesaler_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  phone text,
  notes text,
  created_by UUID REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on store_wholesaler_contacts
ALTER TABLE public.store_wholesaler_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for store_wholesaler_contacts
CREATE POLICY "Authenticated users can view store wholesaler contacts"
ON public.store_wholesaler_contacts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert store wholesaler contacts"
ON public.store_wholesaler_contacts
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update store wholesaler contacts"
ON public.store_wholesaler_contacts
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete store wholesaler contacts"
ON public.store_wholesaler_contacts
FOR DELETE
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_store_wholesaler_contacts_updated_at
BEFORE UPDATE ON public.store_wholesaler_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for efficient store lookups
CREATE INDEX IF NOT EXISTS idx_store_wholesaler_contacts_store_id 
ON public.store_wholesaler_contacts(store_id);