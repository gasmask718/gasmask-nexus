DELETE FROM public.marketplace_commissions WHERE order_item_id IS NULL;
DROP INDEX IF EXISTS public.marketplace_commissions_order_item_uidx;
ALTER TABLE public.marketplace_commissions ALTER COLUMN order_item_id SET NOT NULL;
CREATE UNIQUE INDEX marketplace_commissions_order_item_uidx
  ON public.marketplace_commissions(order_item_id);