ALTER TABLE public.brandaro_demo_sites
  ADD COLUMN IF NOT EXISTS converted_to_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_amount numeric,
  ADD COLUMN IF NOT EXISTS paid_tier text;