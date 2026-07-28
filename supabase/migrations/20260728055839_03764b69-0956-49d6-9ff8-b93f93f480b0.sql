ALTER TABLE public.store_contacts DROP CONSTRAINT IF EXISTS store_contacts_responsiveness_status_check;
ALTER TABLE public.store_contacts ADD CONSTRAINT store_contacts_responsiveness_status_check
  CHECK (responsiveness_status = ANY (ARRAY['responsive'::text,'unresponsive'::text,'unknown'::text,'wrong_number'::text,'not_active'::text]));
CREATE INDEX IF NOT EXISTS idx_store_contacts_bad_number
  ON public.store_contacts (store_id)
  WHERE responsiveness_status IN ('wrong_number','not_active');