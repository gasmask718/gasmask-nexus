
-- ============================================
-- 1️⃣ SHIPMENT GUARD — Cannot Ship Without Label
-- ============================================
CREATE OR REPLACE FUNCTION public.guard_ship_without_label()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label_status text;
  v_tracking text;
BEGIN
  IF NEW.status = 'shipped' AND OLD.status IS DISTINCT FROM 'shipped' THEN

    -- Look up the active label for this fulfillment
    SELECT sl.status, sl.tracking_number
    INTO v_label_status, v_tracking
    FROM public.shipping_labels sl
    WHERE sl.fulfillment_id = NEW.id
      AND sl.status = 'created'
    LIMIT 1;

    IF v_label_status IS NULL THEN
      RAISE EXCEPTION 'Cannot mark shipped without an active shipping label.';
    END IF;

    IF NEW.tracking_number IS NULL AND v_tracking IS NULL THEN
      RAISE EXCEPTION 'Cannot mark shipped without a tracking number.';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_ship_without_label ON public.marketplace_fulfillments;

CREATE TRIGGER trg_guard_ship_without_label
BEFORE UPDATE OF status ON public.marketplace_fulfillments
FOR EACH ROW
EXECUTE FUNCTION public.guard_ship_without_label();

-- ============================================
-- 2️⃣ IMMUTABLE TRACKING AFTER SHIPMENT
-- ============================================
CREATE OR REPLACE FUNCTION public.guard_immutable_tracking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super boolean;
BEGIN
  IF OLD.status = 'shipped' THEN

    -- Check super_admin override
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
    ) INTO v_is_super;

    IF NOT v_is_super THEN
      IF NEW.tracking_number IS DISTINCT FROM OLD.tracking_number
        OR NEW.carrier IS DISTINCT FROM OLD.carrier
        OR NEW.shipping_label_url IS DISTINCT FROM OLD.shipping_label_url THEN
        RAISE EXCEPTION 'Tracking, carrier, and label cannot be modified after shipment. Requires super_admin.';
      END IF;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_immutable_tracking ON public.marketplace_fulfillments;

CREATE TRIGGER trg_guard_immutable_tracking
BEFORE UPDATE ON public.marketplace_fulfillments
FOR EACH ROW
EXECUTE FUNCTION public.guard_immutable_tracking();

-- ============================================
-- 3️⃣ INVENTORY AUTO-DECREMENT ON SHIPMENT
-- ============================================
CREATE OR REPLACE FUNCTION public.decrement_inventory_on_ship()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'shipped' AND OLD.status IS DISTINCT FROM 'shipped' THEN

    UPDATE public.products_all p
    SET inventory_qty = inventory_qty - i.qty,
        updated_at = now()
    FROM public.marketplace_order_items i
    WHERE i.order_id = NEW.order_id
      AND i.wholesaler_id = NEW.wholesaler_id
      AND i.product_id = p.id;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_inventory ON public.marketplace_fulfillments;

CREATE TRIGGER trg_decrement_inventory
AFTER UPDATE OF status ON public.marketplace_fulfillments
FOR EACH ROW
EXECUTE FUNCTION public.decrement_inventory_on_ship();

-- ============================================
-- 4️⃣ PROTECT AGAINST NEGATIVE INVENTORY
-- ============================================
ALTER TABLE public.products_all
ADD CONSTRAINT inventory_non_negative
CHECK (inventory_qty >= 0);
