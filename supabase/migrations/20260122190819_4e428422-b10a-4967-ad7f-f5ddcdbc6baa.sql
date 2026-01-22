-- Drop the existing constraint and add one that includes 'production'
ALTER TABLE public.people DROP CONSTRAINT crm_contacts_type_check;

ALTER TABLE public.people ADD CONSTRAINT crm_contacts_type_check 
CHECK (type = ANY (ARRAY['store'::text, 'driver'::text, 'influencer'::text, 'wholesaler'::text, 'partner'::text, 'lead'::text, 'production'::text, 'biker'::text, 'ambassador'::text]));