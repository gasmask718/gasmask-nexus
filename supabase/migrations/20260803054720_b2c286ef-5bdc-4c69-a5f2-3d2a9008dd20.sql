ALTER TABLE public.brandaro_revenue_tracking
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.brandaro_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.brandaro_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stripe_reference text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS brandaro_revenue_tracking_stripe_ref_uidx
  ON public.brandaro_revenue_tracking (stripe_reference)
  WHERE stripe_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS brandaro_revenue_tracking_client_idx
  ON public.brandaro_revenue_tracking (client_id);

CREATE INDEX IF NOT EXISTS brandaro_revenue_tracking_created_idx
  ON public.brandaro_revenue_tracking (created_at DESC);