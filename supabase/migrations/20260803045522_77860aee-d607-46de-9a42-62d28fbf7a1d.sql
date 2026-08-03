ALTER TABLE public.brandaro_demo_sites
  ADD COLUMN IF NOT EXISTS send_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_send_status text,
  ADD COLUMN IF NOT EXISTS last_send_error text;