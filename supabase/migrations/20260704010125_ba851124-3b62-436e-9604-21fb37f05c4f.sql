ALTER TABLE public.clipper_accounts
  ADD COLUMN IF NOT EXISTS payout_method text DEFAULT 'stripe' CHECK (payout_method IN ('stripe', 'wise', 'paypal')),
  ADD COLUMN IF NOT EXISTS wise_account_id text,
  ADD COLUMN IF NOT EXISTS wise_email text,
  ADD COLUMN IF NOT EXISTS paypal_email text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';