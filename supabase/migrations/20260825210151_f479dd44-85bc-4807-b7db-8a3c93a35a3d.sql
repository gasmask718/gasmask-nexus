-- ============ 1. dd_config: return policy knobs ============
ALTER TABLE public.dd_config
  ADD COLUMN IF NOT EXISTS returns_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS return_window_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS return_destination_default text NOT NULL DEFAULT 'wholesaler',
  ADD COLUMN IF NOT EXISTS return_payer_fault text NOT NULL DEFAULT 'wholesaler',
  ADD COLUMN IF NOT EXISTS return_payer_change_of_mind text NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS dynasty_return_address jsonb,
  ADD COLUMN IF NOT EXISTS return_restocking_fee_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returns_auto_approve_fault boolean NOT NULL DEFAULT false;

ALTER TABLE public.dd_config
  DROP CONSTRAINT IF EXISTS dd_config_return_destination_default_check;
ALTER TABLE public.dd_config
  ADD CONSTRAINT dd_config_return_destination_default_check
  CHECK (return_destination_default IN ('wholesaler','dynasty'));
ALTER TABLE public.dd_config
  DROP CONSTRAINT IF EXISTS dd_config_return_payer_fault_check;
ALTER TABLE public.dd_config
  ADD CONSTRAINT dd_config_return_payer_fault_check
  CHECK (return_payer_fault IN ('customer','dynasty','wholesaler'));
ALTER TABLE public.dd_config
  DROP CONSTRAINT IF EXISTS dd_config_return_payer_com_check;
ALTER TABLE public.dd_config
  ADD CONSTRAINT dd_config_return_payer_com_check
  CHECK (return_payer_change_of_mind IN ('customer','dynasty','wholesaler'));

-- ============ 2. per-wholesaler overrides ============
CREATE TABLE IF NOT EXISTS public.dd_wholesaler_return_settings (
  wholesaler_id uuid PRIMARY KEY,
  return_destination text,
  return_address jsonb,
  return_payer_fault text,
  return_payer_change_of_mind text,
  accepts_returns boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dd_wrs_dest_check CHECK (return_destination IS NULL OR return_destination IN ('wholesaler','dynasty')),
  CONSTRAINT dd_wrs_fault_check CHECK (return_payer_fault IS NULL OR return_payer_fault IN ('customer','dynasty','wholesaler')),
  CONSTRAINT dd_wrs_com_check CHECK (return_payer_change_of_mind IS NULL OR return_payer_change_of_mind IN ('customer','dynasty','wholesaler'))
);
GRANT SELECT ON public.dd_wholesaler_return_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.dd_wholesaler_return_settings TO authenticated;
GRANT ALL ON public.dd_wholesaler_return_settings TO service_role;
ALTER TABLE public.dd_wholesaler_return_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dd_wrs_admin_all ON public.dd_wholesaler_return_settings;
CREATE POLICY dd_wrs_admin_all ON public.dd_wholesaler_return_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

DROP POLICY IF EXISTS dd_wrs_wholesaler_read ON public.dd_wholesaler_return_settings;
CREATE POLICY dd_wrs_wholesaler_read ON public.dd_wholesaler_return_settings
  FOR SELECT TO authenticated
  USING (wholesaler_id IN (SELECT wp.id FROM public.wholesaler_profiles wp WHERE wp.user_id = auth.uid()));

-- ============ 3. returns ============
CREATE SEQUENCE IF NOT EXISTS public.dd_rma_seq;

CREATE TABLE IF NOT EXISTS public.dd_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_number text NOT NULL DEFAULT ('RMA-' || to_char(now(),'YYMM') || '-' || lpad(nextval('public.dd_rma_seq')::text, 5, '0')),
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  user_id uuid,
  customer_email text,
  wholesaler_id uuid,
  reason_code text NOT NULL,
  reason_text text,
  photos text[] NOT NULL DEFAULT '{}',
  quantity integer NOT NULL DEFAULT 1,
  fault_party text NOT NULL DEFAULT 'unknown',
  is_fault_return boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'requested',
  destination text,
  destination_address jsonb,
  shipping_paid_by text,
  return_label_url text,
  return_tracking_number text,
  return_carrier text,
  easypost_shipment_id text,
  label_cost_cents bigint,
  label_error text,
  refund_amount_cents bigint,
  restocking_fee_cents bigint NOT NULL DEFAULT 0,
  stripe_refund_id text,
  split_reversal_id uuid,
  clawback_id uuid,
  approved_by uuid,
  approved_at timestamptz,
  declined_reason text,
  received_at timestamptz,
  refunded_at timestamptz,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dd_returns_status_check CHECK (status IN ('requested','approved','declined','label_created','in_transit','received','refunded','closed','cancelled')),
  CONSTRAINT dd_returns_fault_check CHECK (fault_party IN ('unknown','customer','wholesaler','dynasty')),
  CONSTRAINT dd_returns_dest_check CHECK (destination IS NULL OR destination IN ('wholesaler','dynasty')),
  CONSTRAINT dd_returns_payer_check CHECK (shipping_paid_by IS NULL OR shipping_paid_by IN ('customer','dynasty','wholesaler'))
);
CREATE UNIQUE INDEX IF NOT EXISTS dd_returns_rma_number_key ON public.dd_returns(rma_number);
CREATE INDEX IF NOT EXISTS dd_returns_order_idx ON public.dd_returns(order_id);
CREATE INDEX IF NOT EXISTS dd_returns_status_idx ON public.dd_returns(status);
CREATE INDEX IF NOT EXISTS dd_returns_wholesaler_idx ON public.dd_returns(wholesaler_id);

GRANT SELECT ON public.dd_returns TO authenticated;
GRANT INSERT, UPDATE ON public.dd_returns TO authenticated;
GRANT ALL ON public.dd_returns TO service_role;
ALTER TABLE public.dd_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dd_returns_admin_all ON public.dd_returns;
CREATE POLICY dd_returns_admin_all ON public.dd_returns
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

DROP POLICY IF EXISTS dd_returns_customer_read ON public.dd_returns;
CREATE POLICY dd_returns_customer_read ON public.dd_returns
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
     OR EXISTS (SELECT 1 FROM public.marketplace_orders o WHERE o.id = dd_returns.order_id AND o.user_id = auth.uid()));

DROP POLICY IF EXISTS dd_returns_customer_insert ON public.dd_returns;
CREATE POLICY dd_returns_customer_insert ON public.dd_returns
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()
     AND EXISTS (SELECT 1 FROM public.marketplace_orders o WHERE o.id = dd_returns.order_id AND o.user_id = auth.uid()));

DROP POLICY IF EXISTS dd_returns_wholesaler_read ON public.dd_returns;
CREATE POLICY dd_returns_wholesaler_read ON public.dd_returns
  FOR SELECT TO authenticated
  USING (wholesaler_id IN (SELECT wp.id FROM public.wholesaler_profiles wp WHERE wp.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.dd_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.dd_returns(id) ON DELETE CASCADE,
  order_item_id uuid,
  product_id uuid,
  product_name text,
  qty integer NOT NULL DEFAULT 1,
  unit_price_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dd_return_items_return_idx ON public.dd_return_items(return_id);
GRANT SELECT, INSERT ON public.dd_return_items TO authenticated;
GRANT ALL ON public.dd_return_items TO service_role;
ALTER TABLE public.dd_return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dd_return_items_admin_all ON public.dd_return_items;
CREATE POLICY dd_return_items_admin_all ON public.dd_return_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

DROP POLICY IF EXISTS dd_return_items_scoped_read ON public.dd_return_items;
CREATE POLICY dd_return_items_scoped_read ON public.dd_return_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dd_returns r
    WHERE r.id = dd_return_items.return_id
      AND (r.user_id = auth.uid()
        OR r.wholesaler_id IN (SELECT wp.id FROM public.wholesaler_profiles wp WHERE wp.user_id = auth.uid()))
  ));

-- ============ 4. clawbacks ============
CREATE TABLE IF NOT EXISTS public.dd_wholesaler_clawbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id uuid NOT NULL,
  return_id uuid REFERENCES public.dd_returns(id) ON DELETE SET NULL,
  order_id uuid,
  amount_cents bigint NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  applied_payout_id uuid,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dd_clawback_status_check CHECK (status IN ('pending','applied','waived'))
);
CREATE INDEX IF NOT EXISTS dd_clawbacks_wholesaler_idx ON public.dd_wholesaler_clawbacks(wholesaler_id, status);
GRANT SELECT ON public.dd_wholesaler_clawbacks TO authenticated;
GRANT ALL ON public.dd_wholesaler_clawbacks TO service_role;
ALTER TABLE public.dd_wholesaler_clawbacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dd_clawbacks_admin_all ON public.dd_wholesaler_clawbacks;
CREATE POLICY dd_clawbacks_admin_all ON public.dd_wholesaler_clawbacks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

DROP POLICY IF EXISTS dd_clawbacks_wholesaler_read ON public.dd_wholesaler_clawbacks;
CREATE POLICY dd_clawbacks_wholesaler_read ON public.dd_wholesaler_clawbacks
  FOR SELECT TO authenticated
  USING (wholesaler_id IN (SELECT wp.id FROM public.wholesaler_profiles wp WHERE wp.user_id = auth.uid()));

-- ============ 5. split ledger reversal linkage ============
ALTER TABLE public.dd_split_ledger
  ADD COLUMN IF NOT EXISTS return_id uuid,
  ADD COLUMN IF NOT EXISTS reverses_ledger_id uuid,
  ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'sale';
CREATE INDEX IF NOT EXISTS dd_split_ledger_return_idx ON public.dd_split_ledger(return_id);

-- ============ 6. supplier metrics: returns ============
ALTER TABLE public.dd_supplier_metrics
  ADD COLUMN IF NOT EXISTS returns_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returns_fault integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_rate numeric;

-- ============ 7. support tickets ============
CREATE SEQUENCE IF NOT EXISTS public.dd_ticket_seq;

CREATE TABLE IF NOT EXISTS public.dd_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL DEFAULT ('DD-' || to_char(now(),'YYMM') || '-' || lpad(nextval('public.dd_ticket_seq')::text, 5, '0')),
  order_id uuid REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  user_id uuid,
  customer_email text,
  customer_name text,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  assigned_to uuid,
  wholesaler_id uuid,
  forwarded_to_wholesaler_at timestamptz,
  return_id uuid REFERENCES public.dd_returns(id) ON DELETE SET NULL,
  last_reply_at timestamptz NOT NULL DEFAULT now(),
  last_reply_role text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dd_ticket_status_check CHECK (status IN ('open','pending_customer','pending_wholesaler','resolved','closed')),
  CONSTRAINT dd_ticket_priority_check CHECK (priority IN ('low','normal','high','urgent'))
);
CREATE UNIQUE INDEX IF NOT EXISTS dd_support_tickets_number_key ON public.dd_support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS dd_support_tickets_status_idx ON public.dd_support_tickets(status, last_reply_at DESC);
CREATE INDEX IF NOT EXISTS dd_support_tickets_order_idx ON public.dd_support_tickets(order_id);

GRANT SELECT, INSERT, UPDATE ON public.dd_support_tickets TO authenticated;
GRANT ALL ON public.dd_support_tickets TO service_role;
ALTER TABLE public.dd_support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dd_tickets_admin_all ON public.dd_support_tickets;
CREATE POLICY dd_tickets_admin_all ON public.dd_support_tickets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

DROP POLICY IF EXISTS dd_tickets_customer_read ON public.dd_support_tickets;
CREATE POLICY dd_tickets_customer_read ON public.dd_support_tickets
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS dd_tickets_customer_insert ON public.dd_support_tickets;
CREATE POLICY dd_tickets_customer_insert ON public.dd_support_tickets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS dd_tickets_wholesaler_read ON public.dd_support_tickets;
CREATE POLICY dd_tickets_wholesaler_read ON public.dd_support_tickets
  FOR SELECT TO authenticated
  USING (forwarded_to_wholesaler_at IS NOT NULL
     AND wholesaler_id IN (SELECT wp.id FROM public.wholesaler_profiles wp WHERE wp.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.dd_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.dd_support_tickets(id) ON DELETE CASCADE,
  sender_role text NOT NULL,
  sender_user_id uuid,
  sender_name text,
  body text NOT NULL,
  attachment_url text,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dd_ticket_msg_role_check CHECK (sender_role IN ('customer','admin','wholesaler','system'))
);
CREATE INDEX IF NOT EXISTS dd_ticket_messages_ticket_idx ON public.dd_ticket_messages(ticket_id, created_at);
GRANT SELECT, INSERT ON public.dd_ticket_messages TO authenticated;
GRANT ALL ON public.dd_ticket_messages TO service_role;
ALTER TABLE public.dd_ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dd_ticket_msgs_admin_all ON public.dd_ticket_messages;
CREATE POLICY dd_ticket_msgs_admin_all ON public.dd_ticket_messages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

DROP POLICY IF EXISTS dd_ticket_msgs_customer_read ON public.dd_ticket_messages;
CREATE POLICY dd_ticket_msgs_customer_read ON public.dd_ticket_messages
  FOR SELECT TO authenticated
  USING (is_internal = false AND EXISTS (
    SELECT 1 FROM public.dd_support_tickets t WHERE t.id = dd_ticket_messages.ticket_id AND t.user_id = auth.uid()));

DROP POLICY IF EXISTS dd_ticket_msgs_customer_insert ON public.dd_ticket_messages;
CREATE POLICY dd_ticket_msgs_customer_insert ON public.dd_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_role = 'customer' AND is_internal = false AND sender_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.dd_support_tickets t WHERE t.id = dd_ticket_messages.ticket_id AND t.user_id = auth.uid()));

DROP POLICY IF EXISTS dd_ticket_msgs_wholesaler_read ON public.dd_ticket_messages;
CREATE POLICY dd_ticket_msgs_wholesaler_read ON public.dd_ticket_messages
  FOR SELECT TO authenticated
  USING (is_internal = false AND EXISTS (
    SELECT 1 FROM public.dd_support_tickets t
    WHERE t.id = dd_ticket_messages.ticket_id
      AND t.forwarded_to_wholesaler_at IS NOT NULL
      AND t.wholesaler_id IN (SELECT wp.id FROM public.wholesaler_profiles wp WHERE wp.user_id = auth.uid())));

DROP POLICY IF EXISTS dd_ticket_msgs_wholesaler_insert ON public.dd_ticket_messages;
CREATE POLICY dd_ticket_msgs_wholesaler_insert ON public.dd_ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_role = 'wholesaler' AND is_internal = false AND sender_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.dd_support_tickets t
      WHERE t.id = dd_ticket_messages.ticket_id
        AND t.forwarded_to_wholesaler_at IS NOT NULL
        AND t.wholesaler_id IN (SELECT wp.id FROM public.wholesaler_profiles wp WHERE wp.user_id = auth.uid())));

-- ============ 8. customer accounts ============
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;
CREATE INDEX IF NOT EXISTS customer_profiles_email_idx ON public.customer_profiles(lower(email));

CREATE OR REPLACE FUNCTION public.dd_link_guest_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;
  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = auth.uid();
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.marketplace_orders o
     SET user_id = auth.uid()
   WHERE o.user_id IS NULL
     AND lower(o.customer_email) = v_email;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.dd_returns r
     SET user_id = auth.uid()
   WHERE r.user_id IS NULL AND lower(r.customer_email) = v_email;

  UPDATE public.dd_support_tickets t
     SET user_id = auth.uid()
   WHERE t.user_id IS NULL AND lower(t.customer_email) = v_email;

  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.dd_link_guest_orders() TO authenticated;

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.dd_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS dd_returns_touch ON public.dd_returns;
CREATE TRIGGER dd_returns_touch BEFORE UPDATE ON public.dd_returns
  FOR EACH ROW EXECUTE FUNCTION public.dd_touch_updated_at();
DROP TRIGGER IF EXISTS dd_tickets_touch ON public.dd_support_tickets;
CREATE TRIGGER dd_tickets_touch BEFORE UPDATE ON public.dd_support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.dd_touch_updated_at();
DROP TRIGGER IF EXISTS dd_wrs_touch ON public.dd_wholesaler_return_settings;
CREATE TRIGGER dd_wrs_touch BEFORE UPDATE ON public.dd_wholesaler_return_settings
  FOR EACH ROW EXECUTE FUNCTION public.dd_touch_updated_at();