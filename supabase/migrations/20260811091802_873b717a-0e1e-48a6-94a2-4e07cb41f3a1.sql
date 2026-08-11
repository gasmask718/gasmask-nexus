ALTER TABLE public.business_transactions
  ALTER COLUMN entity_id TYPE text USING entity_id::text;

ALTER TABLE public.business_transactions
  ADD COLUMN IF NOT EXISTS source_system text,
  ADD COLUMN IF NOT EXISTS external_transaction_id text,
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS line_items jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS business_transactions_source_ext_id_uniq
  ON public.business_transactions (source_system, external_transaction_id)
  WHERE source_system IS NOT NULL AND external_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_transactions_occurred_at
  ON public.business_transactions (occurred_at);