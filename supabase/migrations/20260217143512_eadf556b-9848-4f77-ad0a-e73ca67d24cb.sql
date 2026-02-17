
-- Add marketplace_order_id to store_orders to link user-facing orders to ops-facing orders
ALTER TABLE public.store_orders ADD COLUMN IF NOT EXISTS marketplace_order_id UUID REFERENCES public.marketplace_orders(id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_store_orders_marketplace_order_id ON public.store_orders(marketplace_order_id);
