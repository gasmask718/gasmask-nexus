
-- ════════════════════════════════════════════════════════════════════
-- DD INVENTORY MGMT — audit table, per-product threshold, sync guard,
-- adjustment RPC, low-stock notifier, one-time drift reconcile.
-- ════════════════════════════════════════════════════════════════════

-- 1. Per-product low-stock threshold (additive; reorder_point remains as fallback)
ALTER TABLE public.marketplace_inventory
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer,
  ADD COLUMN IF NOT EXISTS last_low_stock_alert_at timestamptz;

-- 2. Audit table for every stock movement
CREATE TABLE IF NOT EXISTS public.dd_inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products_all(id) ON DELETE CASCADE,
  wholesaler_id uuid NOT NULL REFERENCES public.wholesaler_profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'wholesaler_recount','damage','offline_sale','restock',
    'admin_override','reserve','consume','release','sync_recalc'
  )),
  delta integer NOT NULL,
  quantity_before integer NOT NULL,
  quantity_after integer NOT NULL,
  reason text,
  actor_id uuid,
  actor_role text,
  reference_type text,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.dd_inventory_adjustments TO authenticated;
GRANT ALL ON public.dd_inventory_adjustments TO service_role;

ALTER TABLE public.dd_inventory_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wholesalers view own adjustments"
  ON public.dd_inventory_adjustments FOR SELECT TO authenticated
  USING (
    wholesaler_id IN (
      SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'owner'::app_role)
  );

CREATE POLICY "Wholesalers insert own adjustments"
  ON public.dd_inventory_adjustments FOR INSERT TO authenticated
  WITH CHECK (
    wholesaler_id IN (
      SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'owner'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_dd_inv_adj_product ON public.dd_inventory_adjustments(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dd_inv_adj_wholesaler ON public.dd_inventory_adjustments(wholesaler_id, created_at DESC);

-- 3. Sync guard: keep products_all.inventory_qty = SUM(marketplace_inventory.quantity_available)
CREATE OR REPLACE FUNCTION public.dd_recompute_product_inventory_qty(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sum integer;
BEGIN
  SELECT COALESCE(SUM(quantity_available),0) INTO v_sum
  FROM public.marketplace_inventory WHERE product_id = p_product_id;
  UPDATE public.products_all
    SET inventory_qty = v_sum, updated_at = now()
    WHERE id = p_product_id AND inventory_qty IS DISTINCT FROM v_sum;
END;$$;

CREATE OR REPLACE FUNCTION public.trg_dd_sync_product_inventory()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.dd_recompute_product_inventory_qty(OLD.product_id);
    RETURN OLD;
  ELSE
    PERFORM public.dd_recompute_product_inventory_qty(NEW.product_id);
    IF TG_OP = 'UPDATE' AND OLD.product_id <> NEW.product_id THEN
      PERFORM public.dd_recompute_product_inventory_qty(OLD.product_id);
    END IF;
    RETURN NEW;
  END IF;
END;$$;

DROP TRIGGER IF EXISTS trg_dd_sync_product_inventory ON public.marketplace_inventory;
CREATE TRIGGER trg_dd_sync_product_inventory
  AFTER INSERT OR UPDATE OR DELETE ON public.marketplace_inventory
  FOR EACH ROW EXECUTE FUNCTION public.trg_dd_sync_product_inventory();

-- 4. Low-stock notification helper
CREATE OR REPLACE FUNCTION public.dd_check_low_stock(p_product_id uuid, p_wholesaler_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv RECORD;
  v_user uuid;
  v_pname text;
  v_threshold integer;
BEGIN
  SELECT * INTO v_inv FROM public.marketplace_inventory
    WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_threshold := COALESCE(v_inv.low_stock_threshold, v_inv.reorder_point, 10);
  IF v_inv.quantity_available > v_threshold THEN RETURN; END IF;
  -- Throttle: 1 alert / 24h per pair
  IF v_inv.last_low_stock_alert_at IS NOT NULL
     AND v_inv.last_low_stock_alert_at > now() - interval '24 hours' THEN
    RETURN;
  END IF;

  SELECT user_id INTO v_user FROM public.wholesaler_profiles WHERE id = p_wholesaler_id;
  SELECT product_name INTO v_pname FROM public.products_all WHERE id = p_product_id;

  IF v_user IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      v_user,
      'inventory_low_stock',
      CASE WHEN v_inv.quantity_available = 0 THEN 'Out of stock' ELSE 'Low stock alert' END,
      v_pname || ': ' || v_inv.quantity_available || ' units left (threshold ' || v_threshold || ')',
      jsonb_build_object(
        'product_id', p_product_id,
        'wholesaler_id', p_wholesaler_id,
        'quantity_available', v_inv.quantity_available,
        'threshold', v_threshold
      )
    );
  END IF;

  UPDATE public.marketplace_inventory
    SET last_low_stock_alert_at = now()
    WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id;
END;$$;

-- 5. Adjustment RPC — wholesalers + admin
CREATE OR REPLACE FUNCTION public.dd_apply_inventory_adjustment(
  p_product_id uuid,
  p_wholesaler_id uuid,
  p_new_quantity integer,
  p_kind text,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before integer;
  v_delta integer;
  v_actor uuid := auth.uid();
  v_role text;
  v_owns boolean;
BEGIN
  IF p_new_quantity < 0 THEN RAISE EXCEPTION 'quantity must be >= 0'; END IF;
  IF p_kind NOT IN ('wholesaler_recount','damage','offline_sale','restock','admin_override','sync_recalc')
    THEN RAISE EXCEPTION 'invalid adjustment kind: %', p_kind; END IF;

  v_owns := EXISTS (SELECT 1 FROM public.wholesaler_profiles
                    WHERE id = p_wholesaler_id AND user_id = v_actor);
  IF v_owns THEN
    v_role := 'wholesaler';
  ELSIF public.has_role(v_actor,'admin'::app_role) OR public.has_role(v_actor,'owner'::app_role) THEN
    v_role := 'admin';
    IF p_kind NOT IN ('admin_override','sync_recalc') THEN
      p_kind := 'admin_override';
    END IF;
  ELSE
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT quantity_available INTO v_before FROM public.marketplace_inventory
    WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id
    FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.marketplace_inventory(product_id, wholesaler_id, quantity_available, reserved_quantity)
    VALUES (p_product_id, p_wholesaler_id, p_new_quantity, 0);
    v_before := 0;
  ELSE
    UPDATE public.marketplace_inventory
      SET quantity_available = p_new_quantity, updated_at = now()
      WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id;
  END IF;

  v_delta := p_new_quantity - v_before;

  INSERT INTO public.dd_inventory_adjustments(
    product_id, wholesaler_id, kind, delta, quantity_before, quantity_after,
    reason, actor_id, actor_role
  ) VALUES (
    p_product_id, p_wholesaler_id, p_kind, v_delta, v_before, p_new_quantity,
    p_reason, v_actor, v_role
  );

  PERFORM public.dd_check_low_stock(p_product_id, p_wholesaler_id);

  RETURN jsonb_build_object(
    'product_id', p_product_id, 'wholesaler_id', p_wholesaler_id,
    'before', v_before, 'after', p_new_quantity, 'delta', v_delta
  );
END;$$;

-- Per-product threshold setter
CREATE OR REPLACE FUNCTION public.dd_set_inventory_threshold(
  p_product_id uuid, p_wholesaler_id uuid, p_threshold integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owns boolean;
BEGIN
  IF p_threshold < 0 THEN RAISE EXCEPTION 'threshold must be >= 0'; END IF;
  v_owns := EXISTS (SELECT 1 FROM public.wholesaler_profiles
                    WHERE id = p_wholesaler_id AND user_id = auth.uid());
  IF NOT v_owns AND NOT public.has_role(auth.uid(),'admin'::app_role)
     AND NOT public.has_role(auth.uid(),'owner'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.marketplace_inventory
    SET low_stock_threshold = p_threshold, last_low_stock_alert_at = NULL, updated_at = now()
    WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id;
END;$$;

GRANT EXECUTE ON FUNCTION public.dd_apply_inventory_adjustment(uuid,uuid,integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dd_set_inventory_threshold(uuid,uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dd_recompute_product_inventory_qty(uuid) TO authenticated;

-- 6. Log reserve/consume/release into audit table (wrap existing fns)
CREATE OR REPLACE FUNCTION public.reserve_marketplace_inventory(
  p_product_id uuid, p_wholesaler_id uuid, p_qty integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before integer; v_after integer;
BEGIN
  SELECT quantity_available INTO v_before FROM public.marketplace_inventory
    WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id FOR UPDATE;
  IF NOT FOUND OR v_before < p_qty THEN RETURN false; END IF;

  UPDATE public.marketplace_inventory
    SET quantity_available = quantity_available - p_qty,
        reserved_quantity  = reserved_quantity  + p_qty,
        updated_at = now()
    WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id;
  v_after := v_before - p_qty;

  INSERT INTO public.dd_inventory_adjustments(
    product_id, wholesaler_id, kind, delta, quantity_before, quantity_after, reason, actor_role
  ) VALUES (
    p_product_id, p_wholesaler_id, 'reserve', -p_qty, v_before, v_after, 'order reservation', 'system'
  );

  PERFORM public.dd_check_low_stock(p_product_id, p_wholesaler_id);
  RETURN true;
END;$$;

CREATE OR REPLACE FUNCTION public.consume_marketplace_inventory(
  p_product_id uuid, p_wholesaler_id uuid, p_qty integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before integer; v_after integer;
BEGIN
  SELECT quantity_available INTO v_before FROM public.marketplace_inventory
    WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.marketplace_inventory
    SET reserved_quantity = GREATEST(0, reserved_quantity - p_qty),
        updated_at = now()
    WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id;
  v_after := v_before;

  INSERT INTO public.dd_inventory_adjustments(
    product_id, wholesaler_id, kind, delta, quantity_before, quantity_after, reason, actor_role
  ) VALUES (
    p_product_id, p_wholesaler_id, 'consume', 0, v_before, v_after, 'order paid — reservation consumed', 'system'
  );
  RETURN true;
END;$$;

CREATE OR REPLACE FUNCTION public.release_marketplace_inventory(
  p_product_id uuid, p_wholesaler_id uuid, p_qty integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before integer; v_after integer;
BEGIN
  SELECT quantity_available INTO v_before FROM public.marketplace_inventory
    WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.marketplace_inventory
    SET quantity_available = quantity_available + p_qty,
        reserved_quantity  = GREATEST(0, reserved_quantity - p_qty),
        updated_at = now()
    WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id;
  v_after := v_before + p_qty;

  INSERT INTO public.dd_inventory_adjustments(
    product_id, wholesaler_id, kind, delta, quantity_before, quantity_after, reason, actor_role
  ) VALUES (
    p_product_id, p_wholesaler_id, 'release', p_qty, v_before, v_after, 'order cancelled — reservation released', 'system'
  );
  RETURN true;
END;$$;

-- 7. One-time drift reconciliation
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.id FROM public.products_all p
    LEFT JOIN (SELECT product_id, SUM(quantity_available) s FROM public.marketplace_inventory GROUP BY product_id) mi
      ON mi.product_id = p.id
    WHERE p.inventory_qty IS DISTINCT FROM COALESCE(mi.s,0)
  LOOP
    PERFORM public.dd_recompute_product_inventory_qty(r.id);
  END LOOP;
END$$;
