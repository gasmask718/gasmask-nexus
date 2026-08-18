-- Suppression normalization: one canonical key (last 10 digits) on BOTH lists.
-- dnc_list stores E.164 (+17189222137); lead sources store "(347) 201-6324".
-- An exact-string match between those never fires, which made the dialer's DNC
-- check report "checked" while being incapable of blocking. Generated columns
-- normalize at rest so the read side can match on one key.

ALTER TABLE public.dnc_list
  ADD COLUMN IF NOT EXISTS phone_last10 text
  GENERATED ALWAYS AS (
    right(regexp_replace(coalesce(phone_e164, phone_number), '\D', '', 'g'), 10)
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_dnc_list_phone_last10
  ON public.dnc_list (phone_last10);

ALTER TABLE public.opt_out_events
  ADD COLUMN IF NOT EXISTS phone_last10 text
  GENERATED ALWAYS AS (
    right(regexp_replace(phone_number, '\D', '', 'g'), 10)
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_opt_out_events_phone_last10
  ON public.opt_out_events (phone_last10);