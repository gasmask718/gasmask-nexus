ALTER TABLE public.brandaro_stripe_config DROP CONSTRAINT IF EXISTS brandaro_stripe_config_tier_check;
ALTER TABLE public.brandaro_stripe_config ADD CONSTRAINT brandaro_stripe_config_tier_check
  CHECK (tier IN ('starter','pro','custom','hosting'));