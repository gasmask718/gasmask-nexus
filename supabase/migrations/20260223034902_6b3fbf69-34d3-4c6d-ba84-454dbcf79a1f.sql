
-- ============================================
-- 1. SHIPPING LABEL EVENTS (Audit Log)
-- ============================================
CREATE TABLE IF NOT EXISTS public.shipping_label_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id uuid REFERENCES public.shipping_labels(id) ON DELETE CASCADE NOT NULL,
  fulfillment_id uuid REFERENCES public.marketplace_fulfillments(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('created','printed','voided','reprinted','error')),
  actor_user_id uuid,
  meta_json jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_label_events ENABLE ROW LEVEL SECURITY;

-- Vendors can read their own label events
CREATE POLICY "Vendors read own label events"
  ON public.shipping_label_events FOR SELECT TO authenticated
  USING (
    fulfillment_id IN (
      SELECT id FROM public.marketplace_fulfillments
      WHERE wholesaler_id IN (
        SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- Vendors can insert events for their own fulfillments
CREATE POLICY "Vendors insert own label events"
  ON public.shipping_label_events FOR INSERT TO authenticated
  WITH CHECK (
    fulfillment_id IN (
      SELECT id FROM public.marketplace_fulfillments
      WHERE wholesaler_id IN (
        SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================
-- 2. ORDER STATUS SYNC TRIGGER
-- When ALL fulfillments for an order are 'shipped' or 'completed',
-- update the parent order's fulfillment_status accordingly.
-- ============================================
CREATE OR REPLACE FUNCTION public.sync_order_fulfillment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_total int;
  v_shipped int;
  v_completed int;
  v_new_status text;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT count(*),
         count(*) FILTER (WHERE status IN ('shipped','completed')),
         count(*) FILTER (WHERE status = 'completed')
  INTO v_total, v_shipped, v_completed
  FROM public.marketplace_fulfillments
  WHERE order_id = v_order_id;

  IF v_total = 0 THEN
    RETURN NEW;
  END IF;

  IF v_completed = v_total THEN
    v_new_status := 'delivered';
  ELSIF v_shipped = v_total THEN
    v_new_status := 'shipped';
  ELSIF v_shipped > 0 THEN
    v_new_status := 'partially_shipped';
  ELSE
    v_new_status := 'processing';
  END IF;

  UPDATE public.marketplace_orders
  SET fulfillment_status = v_new_status,
      updated_at = now()
  WHERE id = v_order_id
    AND COALESCE(fulfillment_status, '') IS DISTINCT FROM v_new_status;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_fulfillment ON public.marketplace_fulfillments;
CREATE TRIGGER trg_sync_order_fulfillment
  AFTER UPDATE OF status ON public.marketplace_fulfillments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_fulfillment_status();

-- ============================================
-- 3. LABEL LIFECYCLE GUARD
-- Prevent generating a new label if an active one already exists.
-- ============================================
CREATE OR REPLACE FUNCTION public.guard_single_active_label()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.shipping_labels
    WHERE fulfillment_id = NEW.fulfillment_id
      AND status = 'created'
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'An active shipping label already exists for this fulfillment. Void it first.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_single_label ON public.shipping_labels;
CREATE TRIGGER trg_guard_single_label
  BEFORE INSERT ON public.shipping_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_single_active_label();

-- ============================================
-- 4. AUTO-LOG LABEL CREATION EVENT
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_log_label_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.shipping_label_events (label_id, fulfillment_id, event_type, actor_user_id, meta_json)
  VALUES (
    NEW.id,
    NEW.fulfillment_id,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'created'
      WHEN TG_OP = 'UPDATE' AND NEW.status = 'voided' AND OLD.status != 'voided' THEN 'voided'
      ELSE 'created'
    END,
    auth.uid(),
    jsonb_build_object('carrier', NEW.carrier, 'tracking', NEW.tracking_number, 'mode', NEW.mode)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_log_label ON public.shipping_labels;
CREATE TRIGGER trg_auto_log_label
  AFTER INSERT OR UPDATE OF status ON public.shipping_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_log_label_event();
