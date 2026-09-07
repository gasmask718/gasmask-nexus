ALTER TABLE public.va_call_logs
  ADD COLUMN IF NOT EXISTS store_id uuid,
  ADD COLUMN IF NOT EXISTS contact_id uuid;

COMMENT ON COLUMN public.va_call_logs.store_id IS 'Canonical account (store_master) the agent was working when this call was placed. NULL when unknown — never inferred.';
COMMENT ON COLUMN public.va_call_logs.contact_id IS 'Canonical store_contacts row dialled. NULL when unknown — never inferred.';

CREATE INDEX IF NOT EXISTS idx_va_call_logs_store_id ON public.va_call_logs (store_id) WHERE store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_va_call_logs_contact_id ON public.va_call_logs (contact_id) WHERE contact_id IS NOT NULL;