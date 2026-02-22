
-- ============================================================
-- PHASE 6: EVENT-DRIVEN NOTIFICATION ENGINE
-- ============================================================

-- 1. Enum for sent status
CREATE TYPE public.notification_sent_status AS ENUM ('pending', 'sent', 'failed');

-- 2. notification_events table
CREATE TABLE public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  role text NOT NULL CHECK (role IN ('customer', 'vendor', 'admin')),
  event_type text NOT NULL,
  related_order_id uuid REFERENCES public.marketplace_orders(id),
  related_fulfillment_id uuid REFERENCES public.marketplace_fulfillments(id),
  related_message_id uuid REFERENCES public.order_messages(id),
  payload_json jsonb DEFAULT '{}'::jsonb,
  sent_status public.notification_sent_status NOT NULL DEFAULT 'pending',
  retry_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  idempotency_key text NOT NULL UNIQUE,
  -- Future columns placeholder (channel, priority, in_app_delivered)
  channel text NOT NULL DEFAULT 'email'
);

-- Indexes for queue scanning
CREATE INDEX idx_notification_events_sent_status ON public.notification_events(sent_status);
CREATE INDEX idx_notification_events_created_at ON public.notification_events(created_at);
CREATE INDEX idx_notification_events_user_id ON public.notification_events(user_id);

-- RLS: only service role / admin can read; no client inserts
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all notification events"
  ON public.notification_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'admin')
    )
  );

-- No INSERT/UPDATE/DELETE policies for regular users — server-side only

-- ============================================================
-- 3. TRIGGER FUNCTIONS (lightweight — only insert events)
-- ============================================================

-- A) Order paid → vendor gets fulfillment_required
CREATE OR REPLACE FUNCTION public.trg_notify_order_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
    INSERT INTO public.notification_events (user_id, role, event_type, related_order_id, payload_json, idempotency_key)
    SELECT
      NEW.wholesaler_id,
      'vendor',
      'fulfillment_required',
      NEW.id,
      jsonb_build_object('order_id', NEW.id, 'total', NEW.total),
      'fulfillment_required:' || NEW.id || ':' || NEW.wholesaler_id
    WHERE NEW.wholesaler_id IS NOT NULL
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER notify_order_paid
  AFTER UPDATE ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_order_paid();

-- B) Fulfillment shipped → customer gets order_shipped
CREATE OR REPLACE FUNCTION public.trg_notify_fulfillment_shipped()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  IF NEW.status = 'shipped' AND (OLD.status IS DISTINCT FROM 'shipped') THEN
    SELECT user_id INTO v_customer_id FROM public.marketplace_orders WHERE id = NEW.order_id;
    IF v_customer_id IS NOT NULL THEN
      INSERT INTO public.notification_events (user_id, role, event_type, related_order_id, related_fulfillment_id, payload_json, idempotency_key)
      VALUES (
        v_customer_id, 'customer', 'order_shipped', NEW.order_id, NEW.id,
        jsonb_build_object('tracking_number', NEW.tracking_number, 'carrier', NEW.carrier),
        'order_shipped:' || NEW.id || ':' || v_customer_id
      )
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER notify_fulfillment_shipped
  AFTER UPDATE ON public.marketplace_fulfillments
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_fulfillment_shipped();

-- C) Fulfillment completed → customer gets order_delivered
CREATE OR REPLACE FUNCTION public.trg_notify_fulfillment_delivered()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT user_id INTO v_customer_id FROM public.marketplace_orders WHERE id = NEW.order_id;
    IF v_customer_id IS NOT NULL THEN
      INSERT INTO public.notification_events (user_id, role, event_type, related_order_id, related_fulfillment_id, payload_json, idempotency_key)
      VALUES (
        v_customer_id, 'customer', 'order_delivered', NEW.order_id, NEW.id,
        jsonb_build_object('order_id', NEW.order_id),
        'order_delivered:' || NEW.id || ':' || v_customer_id
      )
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER notify_fulfillment_delivered
  AFTER UPDATE ON public.marketplace_fulfillments
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_fulfillment_delivered();

-- D) Payout approved → vendor
CREATE OR REPLACE FUNCTION public.trg_notify_payout_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.notification_events (user_id, role, event_type, related_order_id, payload_json, idempotency_key)
    VALUES (
      NEW.wholesaler_id, 'vendor', 'payout_approved', NEW.order_id,
      jsonb_build_object('net_amount', NEW.net_amount, 'payout_id', NEW.id),
      'payout_approved:' || NEW.id || ':' || NEW.wholesaler_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER notify_payout_approved
  AFTER UPDATE ON public.wholesaler_payouts
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_payout_approved();

-- E) Payout paid → vendor
CREATE OR REPLACE FUNCTION public.trg_notify_payout_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    INSERT INTO public.notification_events (user_id, role, event_type, related_order_id, payload_json, idempotency_key)
    VALUES (
      NEW.wholesaler_id, 'vendor', 'payout_paid', NEW.order_id,
      jsonb_build_object('net_amount', NEW.net_amount, 'paid_at', NEW.paid_at, 'payout_id', NEW.id),
      'payout_paid:' || NEW.id || ':' || NEW.wholesaler_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER notify_payout_paid
  AFTER UPDATE ON public.wholesaler_payouts
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_payout_paid();

-- F) Dispute opened → vendor
CREATE OR REPLACE FUNCTION public.trg_notify_dispute_opened()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.dispute_status = 'opened' AND (OLD.dispute_status IS DISTINCT FROM 'opened') THEN
    IF NEW.wholesaler_id IS NOT NULL THEN
      INSERT INTO public.notification_events (user_id, role, event_type, related_order_id, payload_json, idempotency_key)
      VALUES (
        NEW.wholesaler_id, 'vendor', 'dispute_opened', NEW.id,
        jsonb_build_object('dispute_reason', NEW.dispute_reason, 'order_id', NEW.id),
        'dispute_opened:' || NEW.id || ':' || NEW.wholesaler_id
      )
      ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER notify_dispute_opened
  AFTER UPDATE ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_dispute_opened();

-- G) New message → recipient
CREATE OR REPLACE FUNCTION public.trg_notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id uuid;
  v_vendor_id uuid;
  v_recipient_id uuid;
  v_recipient_role text;
BEGIN
  SELECT user_id, wholesaler_id INTO v_customer_id, v_vendor_id
  FROM public.marketplace_orders WHERE id = NEW.order_id;

  IF NEW.sender_role::text = 'vendor' THEN
    v_recipient_id := v_customer_id;
    v_recipient_role := 'customer';
  ELSIF NEW.sender_role::text = 'customer' THEN
    v_recipient_id := COALESCE(NEW.vendor_id, v_vendor_id);
    v_recipient_role := 'vendor';
  ELSE
    RETURN NEW; -- admin/system messages don't notify
  END IF;

  IF v_recipient_id IS NOT NULL THEN
    INSERT INTO public.notification_events (user_id, role, event_type, related_order_id, related_message_id, payload_json, idempotency_key)
    VALUES (
      v_recipient_id, v_recipient_role, 'new_message', NEW.order_id, NEW.id,
      jsonb_build_object('sender_role', NEW.sender_role::text, 'preview', left(NEW.message_body, 100)),
      'new_message:' || NEW.id || ':' || v_recipient_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER notify_new_message
  AFTER INSERT ON public.order_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_new_message();
