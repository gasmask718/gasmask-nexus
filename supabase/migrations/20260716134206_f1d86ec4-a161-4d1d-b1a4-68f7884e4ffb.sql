ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.store_contacts ADD COLUMN IF NOT EXISTS updated_by uuid;