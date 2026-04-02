
ALTER TABLE public.funding_credit_items
  ADD COLUMN IF NOT EXISTS inquiry_date date,
  ADD COLUMN IF NOT EXISTS date_opened date,
  ADD COLUMN IF NOT EXISTS credit_limit numeric,
  ADD COLUMN IF NOT EXISTS current_balance numeric,
  ADD COLUMN IF NOT EXISTS utilization_pct integer,
  ADD COLUMN IF NOT EXISTS payment_history text,
  ADD COLUMN IF NOT EXISTS scheduled_purge_date date;
