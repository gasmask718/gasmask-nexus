-- Add foreign key constraint from crm_partner_notes.created_by to profiles.id
ALTER TABLE public.crm_partner_notes
ADD CONSTRAINT crm_partner_notes_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.profiles(id);