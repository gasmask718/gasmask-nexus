CREATE TABLE public.brandaro_stripe_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('test','live')),
  tier text NOT NULL CHECK (tier IN ('starter','pro','custom')),
  product_id text,
  price_id text,
  amount_cents integer,
  currency text NOT NULL DEFAULT 'usd',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mode, tier)
);

GRANT ALL ON public.brandaro_stripe_config TO service_role;

ALTER TABLE public.brandaro_stripe_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brandaro_stripe_config_service_only"
ON public.brandaro_stripe_config
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_brandaro_stripe_config_updated_at
BEFORE UPDATE ON public.brandaro_stripe_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();