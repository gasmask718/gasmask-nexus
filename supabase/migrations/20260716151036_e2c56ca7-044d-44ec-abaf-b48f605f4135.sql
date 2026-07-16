ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS needs_order boolean,
  ADD COLUMN IF NOT EXISTS bring_samples boolean,
  ADD COLUMN IF NOT EXISTS updated_by uuid;