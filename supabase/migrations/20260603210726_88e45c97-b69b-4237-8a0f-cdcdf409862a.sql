-- Drop FK on communication_logs.contact_id so it can softly reference either
-- people.id (AI/manual call/SMS sources) or store_contacts.id (quick-reply mirror).
-- Column stays; queries still work. This is a soft reference by convention.
ALTER TABLE public.communication_logs
  DROP CONSTRAINT IF EXISTS communication_logs_contact_id_fkey;

COMMENT ON COLUMN public.communication_logs.contact_id IS
  'Soft reference (no FK). May point to people.id (AI/manual comms) or store_contacts.id (quick-reply mirror inserts). Resolve via source/channel context.';