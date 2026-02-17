-- Allow store_orders to exist without a store (for marketplace-sourced orders)
ALTER TABLE public.store_orders ALTER COLUMN store_id DROP NOT NULL;