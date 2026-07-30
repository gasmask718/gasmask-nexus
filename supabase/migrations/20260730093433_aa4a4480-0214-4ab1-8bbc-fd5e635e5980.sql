ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS age_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS age_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS age_confirmed_ip text;

COMMENT ON COLUMN public.marketplace_orders.age_confirmed IS 'Buyer affirmed 21+ at point of sale (checkout) for orders containing age-restricted items.';