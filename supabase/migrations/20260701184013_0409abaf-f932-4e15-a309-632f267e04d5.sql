ALTER TABLE public.wholesalers
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_call_disposition text,
  ADD COLUMN IF NOT EXISTS call_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inventory_notes text,
  ADD COLUMN IF NOT EXISTS callback_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS preferred_contact text,
  ADD COLUMN IF NOT EXISTS compliance_hold boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS compliance_hold_reason text,
  ADD COLUMN IF NOT EXISTS phone_invalid boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_wholesalers_callable
  ON public.wholesalers(last_contacted_at)
  WHERE deleted_at IS NULL
    AND is_simulation = false
    AND phone IS NOT NULL
    AND phone_invalid = false
    AND compliance_hold = false;