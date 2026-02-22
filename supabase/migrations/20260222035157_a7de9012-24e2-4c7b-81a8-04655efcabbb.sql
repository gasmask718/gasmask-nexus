
-- Function: sync order fulfillment status when individual fulfillments update
CREATE OR REPLACE FUNCTION public.sync_order_fulfillment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_total_fulfillments int;
  v_shipped_count int;
  v_completed_count int;
  v_new_status text;
BEGIN
  v_order_id := NEW.order_id;

  SELECT count(*),
         count(*) FILTER (WHERE status IN ('shipped', 'completed')),
         count(*) FILTER (WHERE status = 'completed')
  INTO v_total_fulfillments, v_shipped_count, v_completed_count
  FROM marketplace_fulfillments
  WHERE order_id = v_order_id;

  IF v_completed_count = v_total_fulfillments AND v_total_fulfillments > 0 THEN
    v_new_status := 'delivered';
  ELSIF v_shipped_count = v_total_fulfillments AND v_total_fulfillments > 0 THEN
    v_new_status := 'shipped';
  ELSIF v_shipped_count > 0 THEN
    v_new_status := 'partially_shipped';
  ELSE
    v_new_status := NULL;
  END IF;

  IF v_new_status IS NOT NULL THEN
    UPDATE marketplace_orders
    SET fulfillment_status = v_new_status
    WHERE id = v_order_id
      AND fulfillment_status != v_new_status;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on fulfillment status change
DROP TRIGGER IF EXISTS trg_sync_order_fulfillment ON marketplace_fulfillments;
CREATE TRIGGER trg_sync_order_fulfillment
  AFTER UPDATE OF status ON marketplace_fulfillments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION sync_order_fulfillment_status();

-- RLS for marketplace_fulfillments
ALTER TABLE public.marketplace_fulfillments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wholesalers view own fulfillments"
  ON public.marketplace_fulfillments
  FOR SELECT
  USING (
    wholesaler_id IN (
      SELECT id FROM wholesaler_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins full access fulfillments"
  ON public.marketplace_fulfillments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Wholesalers update own fulfillments"
  ON public.marketplace_fulfillments
  FOR UPDATE
  USING (
    wholesaler_id IN (
      SELECT id FROM wholesaler_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    wholesaler_id IN (
      SELECT id FROM wholesaler_profiles WHERE user_id = auth.uid()
    )
  );
