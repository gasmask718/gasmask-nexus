
-- Global marketplace configuration (kill switch etc.)
CREATE TABLE IF NOT EXISTS public.marketplace_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.marketplace_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view marketplace_config"
ON public.marketplace_config FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update marketplace_config"
ON public.marketplace_config FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert marketplace_config"
ON public.marketplace_config FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

-- Seed the marketplace freeze config
INSERT INTO public.marketplace_config (key, value) VALUES ('marketplace_freeze', '{"active": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Add indexes for faster control tower queries
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_payment_status ON public.marketplace_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_dispute_status ON public.marketplace_orders(dispute_status);
CREATE INDEX IF NOT EXISTS idx_marketplace_fulfillments_status ON public.marketplace_fulfillments(status);
