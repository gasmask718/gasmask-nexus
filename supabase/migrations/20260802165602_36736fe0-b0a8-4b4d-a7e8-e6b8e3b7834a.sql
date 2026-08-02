ALTER TABLE public.marketplace_commissions DROP CONSTRAINT IF EXISTS marketplace_commissions_order_id_fkey;
ALTER TABLE public.marketplace_commissions
  ADD CONSTRAINT marketplace_commissions_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.marketplace_orders(id) ON DELETE CASCADE;
ALTER TABLE public.marketplace_commissions DROP CONSTRAINT IF EXISTS marketplace_commissions_order_item_id_fkey;
ALTER TABLE public.marketplace_commissions
  ADD CONSTRAINT marketplace_commissions_order_item_id_fkey
  FOREIGN KEY (order_item_id) REFERENCES public.marketplace_order_items(id) ON DELETE CASCADE;