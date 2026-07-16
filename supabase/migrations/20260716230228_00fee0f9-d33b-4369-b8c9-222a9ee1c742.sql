-- Fix R11: responsive flags defaulted to TRUE causing every new contact to look green.
ALTER TABLE public.store_contacts ALTER COLUMN responsive_by_call SET DEFAULT false;
ALTER TABLE public.store_contacts ALTER COLUMN responsive_by_text SET DEFAULT false;

-- Reset historical rows that were never actually confirmed responsive.
UPDATE public.store_contacts
SET responsive_by_call = false,
    responsive_by_text = false
WHERE last_responded_at IS NULL
  AND (responsive_by_call IS DISTINCT FROM false OR responsive_by_text IS DISTINCT FROM false);