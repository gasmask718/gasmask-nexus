ALTER TABLE public.va_invoices
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS deposit_percent numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric,
  ADD COLUMN IF NOT EXISTS final_amount numeric,
  ADD COLUMN IF NOT EXISTS deposit_payment_link text,
  ADD COLUMN IF NOT EXISTS final_payment_link text,
  ADD COLUMN IF NOT EXISTS deposit_session_id text,
  ADD COLUMN IF NOT EXISTS final_session_id text,
  ADD COLUMN IF NOT EXISTS full_session_id text,
  ADD COLUMN IF NOT EXISTS deposit_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS final_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'va_invoices_payment_type_check'
  ) THEN
    ALTER TABLE public.va_invoices
      ADD CONSTRAINT va_invoices_payment_type_check
      CHECK (payment_type IN ('full','split'));
  END IF;
END $$;