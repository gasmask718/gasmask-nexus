ALTER TABLE public.clipper_accounts
  ADD COLUMN IF NOT EXISTS payoneer_email text,
  ADD COLUMN IF NOT EXISTS payoneer_id text;

ALTER TABLE public.clipper_accounts
  DROP CONSTRAINT IF EXISTS clipper_accounts_payout_method_check;

ALTER TABLE public.clipper_accounts
  ADD CONSTRAINT clipper_accounts_payout_method_check
  CHECK (payout_method IN ('stripe', 'wise', 'paypal', 'payoneer'));