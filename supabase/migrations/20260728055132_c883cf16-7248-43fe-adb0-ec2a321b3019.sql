ALTER TABLE public.store_contacts
  ADD COLUMN IF NOT EXISTS owner_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS is_homie boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS homie_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS homie_set_by uuid;

CREATE INDEX IF NOT EXISTS idx_store_contacts_owner_confirmed
  ON public.store_contacts (store_id) WHERE owner_confirmed;

CREATE INDEX IF NOT EXISTS idx_store_contacts_is_homie
  ON public.store_contacts (store_id) WHERE is_homie;