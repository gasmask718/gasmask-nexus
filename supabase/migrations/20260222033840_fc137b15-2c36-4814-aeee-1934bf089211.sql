
-- Add 'awaiting_fulfillment' and 'partially_shipped' to the fulfillment_status check constraint
ALTER TABLE public.marketplace_orders DROP CONSTRAINT IF EXISTS marketplace_orders_fulfillment_status_check;
ALTER TABLE public.marketplace_orders ADD CONSTRAINT marketplace_orders_fulfillment_status_check
  CHECK (fulfillment_status IN ('pending', 'processing', 'label_created', 'awaiting_fulfillment', 'partially_shipped', 'shipped', 'delivered', 'cancelled'));
