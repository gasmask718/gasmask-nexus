ALTER TABLE public.store_contacts
  ADD COLUMN IF NOT EXISTS opted_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS opted_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS opted_out_method text;

CREATE INDEX IF NOT EXISTS idx_store_contacts_opted_out
  ON public.store_contacts(opted_out) WHERE opted_out = true;