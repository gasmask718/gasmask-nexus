ALTER TABLE public.store_contacts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS delete_reason text;

CREATE INDEX IF NOT EXISTS idx_store_contacts_live
  ON public.store_contacts (store_id)
  WHERE deleted_at IS NULL;