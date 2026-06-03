ALTER TABLE public.tt_partners
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric,
  ALTER COLUMN country SET DEFAULT 'US';