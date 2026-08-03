-- =========================================================
-- 1. COMMISSION LINE STATE MACHINE
-- =========================================================
ALTER TABLE public.marketplace_commissions
  ADD COLUMN IF NOT EXISTS routed_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS release_eligible_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS sales_channel text,
  ADD COLUMN IF NOT EXISTS hold_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS fulfillment_id uuid,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_reason text,
  ADD COLUMN IF NOT EXISTS payout_batch_id uuid,
  ADD COLUMN IF NOT EXISTS void_reason text;

ALTER TABLE public.marketplace_commissions
  DROP CONSTRAINT IF EXISTS marketplace_commissions_payout_status_chk;
ALTER TABLE public.marketplace_commissions
  ADD CONSTRAINT marketplace_commissions_payout_status_chk CHECK (
    payout_status = ANY (ARRAY[
      'held','routed_to_supplier','shipped','delivered',
      'approved','paid','reversed','void','clawed_back'
    ])
  );

CREATE INDEX IF NOT EXISTS idx_mc_payout_status ON public.marketplace_commissions(payout_status);
CREATE INDEX IF NOT EXISTS idx_mc_release_eligible ON public.marketplace_commissions(release_eligible_at)
  WHERE payout_status IN ('shipped','delivered','approved');

-- =========================================================
-- 2. SUPPLIER PAYOUT BATCHES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.supplier_payout_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL,
  batch_date date NOT NULL DEFAULT CURRENT_DATE,
  item_count integer NOT NULL DEFAULT 0,
  gross_payable_cents bigint NOT NULL DEFAULT 0,
  clawback_applied_cents bigint NOT NULL DEFAULT 0,
  net_payable_cents bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'created',
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_payout_batches_status_chk
    CHECK (status = ANY (ARRAY['created','approved','paid','failed','void'])),
  CONSTRAINT supplier_payout_batches_uniq UNIQUE (supplier_id, batch_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payout_batches TO authenticated;
GRANT ALL ON public.supplier_payout_batches TO service_role;
ALTER TABLE public.supplier_payout_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spb_admin_all" ON public.supplier_payout_batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE TABLE IF NOT EXISTS public.supplier_payout_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.supplier_payout_batches(id) ON DELETE CASCADE,
  commission_id uuid NOT NULL REFERENCES public.marketplace_commissions(id) ON DELETE CASCADE,
  order_id uuid,
  amount_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spbi_uniq UNIQUE (batch_id, commission_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_payout_batch_items TO authenticated;
GRANT ALL ON public.supplier_payout_batch_items TO service_role;
ALTER TABLE public.supplier_payout_batch_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spbi_admin_all" ON public.supplier_payout_batch_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

-- =========================================================
-- 3. CLAWBACKS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.supplier_clawbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL,
  commission_id uuid REFERENCES public.marketplace_commissions(id) ON DELETE SET NULL,
  order_id uuid,
  amount_cents bigint NOT NULL DEFAULT 0,
  remaining_cents bigint NOT NULL DEFAULT 0,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  applied_batch_id uuid REFERENCES public.supplier_payout_batches(id) ON DELETE SET NULL,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_clawbacks_reason_chk
    CHECK (reason = ANY (ARRAY['refund','chargeback','manual'])),
  CONSTRAINT supplier_clawbacks_status_chk
    CHECK (status = ANY (ARRAY['open','partially_applied','applied','waived']))
);
CREATE INDEX IF NOT EXISTS idx_clawbacks_open ON public.supplier_clawbacks(supplier_id) WHERE status IN ('open','partially_applied');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_clawbacks TO authenticated;
GRANT ALL ON public.supplier_clawbacks TO service_role;
ALTER TABLE public.supplier_clawbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clawbacks_admin_all" ON public.supplier_clawbacks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

-- =========================================================
-- 4. SUPPLIER SLA
-- =========================================================
CREATE TABLE IF NOT EXISTS public.supplier_sla_records (
  supplier_id uuid PRIMARY KEY,
  late_shipment_count integer NOT NULL DEFAULT 0,
  open_flag_count integer NOT NULL DEFAULT 0,
  last_flag_at timestamptz,
  sla_status text NOT NULL DEFAULT 'good',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_sla_status_chk CHECK (sla_status = ANY (ARRAY['good','warning','breach']))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_sla_records TO authenticated;
GRANT ALL ON public.supplier_sla_records TO service_role;
ALTER TABLE public.supplier_sla_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_rec_admin_all" ON public.supplier_sla_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE TABLE IF NOT EXISTS public.supplier_sla_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL,
  commission_id uuid REFERENCES public.marketplace_commissions(id) ON DELETE CASCADE,
  order_id uuid,
  flag_type text NOT NULL DEFAULT 'unshipped_72h',
  hours_elapsed numeric,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sla_flag_uniq UNIQUE (commission_id, flag_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_sla_flags TO authenticated;
GRANT ALL ON public.supplier_sla_flags TO service_role;
ALTER TABLE public.supplier_sla_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sla_flag_admin_all" ON public.supplier_sla_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

-- =========================================================
-- 5. CHARGEBACK LIABILITY LOG (no VAMP/dispute-rate tracking existed)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.dd_chargeback_liability_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  supplier_id uuid,
  chargeback_cents bigint NOT NULL DEFAULT 0,
  absorbed_by_dynasty_cents bigint NOT NULL DEFAULT 0,
  passed_to_supplier_cents bigint NOT NULL DEFAULT 0,
  clawback_id uuid REFERENCES public.supplier_clawbacks(id) ON DELETE SET NULL,
  vamp_tracked boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_chargeback_liability_log TO authenticated;
GRANT ALL ON public.dd_chargeback_liability_log TO service_role;
ALTER TABLE public.dd_chargeback_liability_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cb_log_admin_all" ON public.dd_chargeback_liability_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

-- =========================================================
-- 6. updated_at triggers
-- =========================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_spb_touch ON public.supplier_payout_batches;
CREATE TRIGGER trg_spb_touch BEFORE UPDATE ON public.supplier_payout_batches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_clawback_touch ON public.supplier_clawbacks;
CREATE TRIGGER trg_clawback_touch BEFORE UPDATE ON public.supplier_clawbacks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_sla_touch ON public.supplier_sla_records;
CREATE TRIGGER trg_sla_touch BEFORE UPDATE ON public.supplier_sla_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 7. CHANNEL / HOLD RESOLUTION
-- =========================================================
CREATE OR REPLACE FUNCTION public.dd_resolve_sales_channel(p_order_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN o.order_type IN ('store','wholesale','b2b') OR o.ordering_store_id IS NOT NULL THEN 'b2b'
    ELSE 'd2c' END
  FROM marketplace_orders o WHERE o.id = p_order_id;
$$;

-- =========================================================
-- 8. ROUTED / SHIPPED / DELIVERED TRANSITIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.dd_commission_fulfillment_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_channel text;
  v_hold integer;
  v_shipped boolean;
BEGIN
  v_channel := public.dd_resolve_sales_channel(NEW.order_id);
  v_hold := CASE WHEN v_channel = 'b2b' THEN 0 ELSE 7 END;
  v_shipped := NULLIF(trim(COALESCE(NEW.tracking_number,'')),'') IS NOT NULL;

  -- routed_to_supplier
  UPDATE marketplace_commissions c
  SET payout_status = 'routed_to_supplier',
      routed_at = COALESCE(c.routed_at, now()),
      fulfillment_id = NEW.id,
      sales_channel = v_channel,
      hold_days = v_hold,
      updated_at = now()
  FROM marketplace_order_items oi
  WHERE oi.id = c.order_item_id
    AND oi.order_id = NEW.order_id
    AND oi.wholesaler_id = NEW.wholesaler_id
    AND c.payout_status = 'held';

  -- shipped: tracking uploaded => start the hold clock
  IF v_shipped THEN
    UPDATE marketplace_commissions c
    SET payout_status = 'shipped',
        shipped_at = COALESCE(c.shipped_at, now()),
        release_eligible_at = COALESCE(c.release_eligible_at, now() + (v_hold || ' days')::interval),
        fulfillment_id = NEW.id,
        sales_channel = v_channel,
        hold_days = v_hold,
        escalated_at = NULL,
        escalation_reason = NULL,
        updated_at = now()
    FROM marketplace_order_items oi
    WHERE oi.id = c.order_item_id
      AND oi.order_id = NEW.order_id
      AND oi.wholesaler_id = NEW.wholesaler_id
      AND c.payout_status IN ('held','routed_to_supplier');

    UPDATE supplier_sla_flags SET resolved_at = now()
    WHERE resolved_at IS NULL
      AND order_id = NEW.order_id
      AND supplier_id = NEW.wholesaler_id;
  END IF;

  -- delivered
  IF NEW.status = 'completed' THEN
    UPDATE marketplace_commissions c
    SET payout_status = 'delivered',
        delivered_at = COALESCE(c.delivered_at, now()),
        shipped_at = COALESCE(c.shipped_at, now()),
        release_eligible_at = COALESCE(c.release_eligible_at, now() + (v_hold || ' days')::interval),
        updated_at = now()
    FROM marketplace_order_items oi
    WHERE oi.id = c.order_item_id
      AND oi.order_id = NEW.order_id
      AND oi.wholesaler_id = NEW.wholesaler_id
      AND c.payout_status IN ('held','routed_to_supplier','shipped');
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_commission_fulfillment_sync ON public.marketplace_fulfillments;
CREATE TRIGGER trg_commission_fulfillment_sync
  AFTER INSERT OR UPDATE ON public.marketplace_fulfillments
  FOR EACH ROW EXECUTE FUNCTION public.dd_commission_fulfillment_sync();

-- =========================================================
-- 9. 72H UNSHIPPED ESCALATION
-- =========================================================
CREATE OR REPLACE FUNCTION public.dd_flag_unshipped_commissions(p_hours integer DEFAULT 72)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_flagged integer := 0; v_r record;
BEGIN
  FOR v_r IN
    SELECT c.id, c.order_id, COALESCE(c.wholesaler_id, c.supplier_id) AS supplier_id,
           EXTRACT(EPOCH FROM (now() - c.routed_at))/3600 AS hrs
    FROM marketplace_commissions c
    WHERE c.payout_status = 'routed_to_supplier'
      AND c.routed_at IS NOT NULL
      AND c.routed_at < now() - (p_hours || ' hours')::interval
  LOOP
    IF v_r.supplier_id IS NULL THEN CONTINUE; END IF;

    UPDATE marketplace_commissions
    SET escalated_at = COALESCE(escalated_at, now()),
        escalation_reason = 'unshipped_' || p_hours || 'h',
        updated_at = now()
    WHERE id = v_r.id;

    INSERT INTO supplier_sla_flags (supplier_id, commission_id, order_id, flag_type, hours_elapsed)
    VALUES (v_r.supplier_id, v_r.id, v_r.order_id, 'unshipped_72h', round(v_r.hrs,2))
    ON CONFLICT (commission_id, flag_type) DO NOTHING;

    IF FOUND THEN
      INSERT INTO supplier_sla_records (supplier_id, late_shipment_count, open_flag_count, last_flag_at, sla_status)
      VALUES (v_r.supplier_id, 1, 1, now(), 'warning')
      ON CONFLICT (supplier_id) DO UPDATE
        SET late_shipment_count = supplier_sla_records.late_shipment_count + 1,
            open_flag_count = supplier_sla_records.open_flag_count + 1,
            last_flag_at = now(),
            sla_status = CASE WHEN supplier_sla_records.late_shipment_count + 1 >= 5 THEN 'breach' ELSE 'warning' END;
      v_flagged := v_flagged + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('flagged', v_flagged, 'threshold_hours', p_hours, 'ran_at', now());
END; $$;

-- =========================================================
-- 10. DAILY PAYOUT BATCH RELEASE
-- =========================================================
CREATE OR REPLACE FUNCTION public.dd_run_supplier_payout_batch(p_batch_date date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sup record; v_line record; v_batch_id uuid;
  v_gross bigint; v_claw bigint; v_apply bigint; v_cb record; v_remaining bigint;
  v_batches integer := 0; v_items integer := 0; v_total bigint := 0;
BEGIN
  FOR v_sup IN
    SELECT COALESCE(c.wholesaler_id, c.supplier_id) AS supplier_id
    FROM marketplace_commissions c
    JOIN marketplace_orders o ON o.id = c.order_id
    WHERE c.payout_status IN ('shipped','delivered','approved')
      AND c.shipped_at IS NOT NULL
      AND c.release_eligible_at IS NOT NULL
      AND c.release_eligible_at <= now()
      AND COALESCE(o.payment_status,'') = 'paid'
      AND COALESCE(o.dispute_status,'none') NOT IN ('open','chargeback','lost')
      AND COALESCE(c.wholesaler_id, c.supplier_id) IS NOT NULL
    GROUP BY 1
  LOOP
    v_gross := 0;
    INSERT INTO supplier_payout_batches (supplier_id, batch_date, status)
    VALUES (v_sup.supplier_id, p_batch_date, 'created')
    ON CONFLICT (supplier_id, batch_date) DO UPDATE SET updated_at = now()
    RETURNING id INTO v_batch_id;

    FOR v_line IN
      SELECT c.id, c.order_id,
             GREATEST(COALESCE(c.supplier_payable_cents, round(COALESCE(c.wholesaler_net,0)*100)::bigint), 0) AS amt
      FROM marketplace_commissions c
      JOIN marketplace_orders o ON o.id = c.order_id
      WHERE COALESCE(c.wholesaler_id, c.supplier_id) = v_sup.supplier_id
        AND c.payout_status IN ('shipped','delivered','approved')
        AND c.release_eligible_at <= now()
        AND COALESCE(o.payment_status,'') = 'paid'
        AND COALESCE(o.dispute_status,'none') NOT IN ('open','chargeback','lost')
      FOR UPDATE OF c
    LOOP
      INSERT INTO supplier_payout_batch_items (batch_id, commission_id, order_id, amount_cents)
      VALUES (v_batch_id, v_line.id, v_line.order_id, v_line.amt)
      ON CONFLICT (batch_id, commission_id) DO NOTHING;

      UPDATE marketplace_commissions
      SET payout_status = 'paid', released_at = now(), payout_batch_id = v_batch_id, updated_at = now()
      WHERE id = v_line.id;

      v_gross := v_gross + v_line.amt;
      v_items := v_items + 1;
    END LOOP;

    -- net open clawbacks against this batch
    v_claw := 0; v_remaining := v_gross;
    FOR v_cb IN
      SELECT id, remaining_cents FROM supplier_clawbacks
      WHERE supplier_id = v_sup.supplier_id AND status IN ('open','partially_applied')
        AND remaining_cents > 0
      ORDER BY created_at
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_apply := LEAST(v_cb.remaining_cents, v_remaining);
      UPDATE supplier_clawbacks
      SET remaining_cents = remaining_cents - v_apply,
          status = CASE WHEN remaining_cents - v_apply <= 0 THEN 'applied' ELSE 'partially_applied' END,
          applied_batch_id = v_batch_id,
          applied_at = now()
      WHERE id = v_cb.id;
      v_claw := v_claw + v_apply;
      v_remaining := v_remaining - v_apply;
    END LOOP;

    UPDATE supplier_payout_batches
    SET item_count = (SELECT count(*) FROM supplier_payout_batch_items WHERE batch_id = v_batch_id),
        gross_payable_cents = v_gross,
        clawback_applied_cents = v_claw,
        net_payable_cents = v_gross - v_claw,
        status = 'approved'
    WHERE id = v_batch_id;

    v_batches := v_batches + 1;
    v_total := v_total + (v_gross - v_claw);
  END LOOP;

  RETURN jsonb_build_object('batch_date', p_batch_date, 'batches', v_batches,
                            'line_items', v_items, 'net_payable_cents', v_total, 'ran_at', now());
END; $$;

-- =========================================================
-- 11. REFUND HANDLING
-- =========================================================
CREATE OR REPLACE FUNCTION public.dd_handle_order_refund(p_order_id uuid, p_reason text DEFAULT 'refund')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_c record; v_cancelled integer := 0; v_clawed integer := 0; v_claw_cents bigint := 0; v_id uuid;
BEGIN
  FOR v_c IN
    SELECT c.id, c.order_id, c.payout_status,
           COALESCE(c.wholesaler_id, c.supplier_id) AS supplier_id,
           GREATEST(COALESCE(c.supplier_payable_cents, round(COALESCE(c.wholesaler_net,0)*100)::bigint),0) AS amt
    FROM marketplace_commissions c WHERE c.order_id = p_order_id FOR UPDATE OF c
  LOOP
    IF v_c.payout_status = 'paid' THEN
      INSERT INTO supplier_clawbacks (supplier_id, commission_id, order_id, amount_cents, remaining_cents, reason)
      VALUES (v_c.supplier_id, v_c.id, v_c.order_id, v_c.amt, v_c.amt,
              CASE WHEN p_reason = 'chargeback' THEN 'chargeback' ELSE 'refund' END)
      RETURNING id INTO v_id;
      UPDATE marketplace_commissions
      SET payout_status = 'clawed_back', void_reason = p_reason, updated_at = now() WHERE id = v_c.id;
      v_clawed := v_clawed + 1; v_claw_cents := v_claw_cents + v_c.amt;
    ELSIF v_c.payout_status NOT IN ('void','clawed_back','reversed') THEN
      UPDATE marketplace_commissions
      SET payout_status = 'void', void_reason = p_reason, release_eligible_at = NULL, updated_at = now()
      WHERE id = v_c.id;
      v_cancelled := v_cancelled + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('order_id', p_order_id, 'reason', p_reason,
    'payables_cancelled', v_cancelled, 'clawbacks_created', v_clawed,
    'clawback_cents', v_claw_cents, 'money_moved', v_clawed > 0);
END; $$;

-- =========================================================
-- 12. CHARGEBACK: DYNASTY MARGIN FIRST, THEN SUPPLIER
-- =========================================================
CREATE OR REPLACE FUNCTION public.dd_handle_order_chargeback(p_order_id uuid, p_amount_cents bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_amount bigint; v_dynasty bigint; v_absorb bigint; v_pass bigint;
  v_supplier uuid; v_claw uuid; v_refund jsonb; v_paid_out bigint;
BEGIN
  SELECT COALESCE(p_amount_cents, round(COALESCE(o.total,0)*100)::bigint) INTO v_amount
  FROM marketplace_orders o WHERE o.id = p_order_id;
  IF v_amount IS NULL THEN RAISE EXCEPTION 'Order % not found', p_order_id; END IF;

  SELECT COALESCE(SUM(GREATEST(COALESCE(c.dynasty_net_cents,0),0)),0),
         COALESCE(SUM(CASE WHEN c.payout_status = 'paid'
                           THEN GREATEST(COALESCE(c.supplier_payable_cents, round(COALESCE(c.wholesaler_net,0)*100)::bigint),0)
                           ELSE 0 END),0),
         MIN(COALESCE(c.wholesaler_id, c.supplier_id))
  INTO v_dynasty, v_paid_out, v_supplier
  FROM marketplace_commissions c WHERE c.order_id = p_order_id;

  -- Dynasty absorbs from its own margin first
  v_absorb := LEAST(v_dynasty, v_amount);
  v_pass := GREATEST(v_amount - v_absorb, 0);
  -- can only pass through what the supplier was actually paid
  v_pass := LEAST(v_pass, v_paid_out);

  -- cancel unreleased payables / claw back released ones
  v_refund := public.dd_handle_order_refund(p_order_id, 'chargeback');

  IF v_pass > 0 AND v_supplier IS NOT NULL THEN
    SELECT id INTO v_claw FROM supplier_clawbacks
    WHERE order_id = p_order_id AND reason = 'chargeback' ORDER BY created_at DESC LIMIT 1;
  END IF;

  UPDATE marketplace_orders
  SET dispute_status = 'chargeback', dispute_reason = COALESCE(dispute_reason,'chargeback'),
      dispute_opened_at = COALESCE(dispute_opened_at, now()), updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO dd_chargeback_liability_log
    (order_id, supplier_id, chargeback_cents, absorbed_by_dynasty_cents, passed_to_supplier_cents,
     clawback_id, vamp_tracked, notes)
  VALUES (p_order_id, v_supplier, v_amount, v_absorb, v_pass, v_claw, false,
          'No VAMP/dispute-rate threshold table exists yet; logged here for rate tracking.');

  RETURN jsonb_build_object('order_id', p_order_id, 'chargeback_cents', v_amount,
    'absorbed_by_dynasty_cents', v_absorb, 'passed_to_supplier_cents', v_pass,
    'refund_result', v_refund);
END; $$;

REVOKE EXECUTE ON FUNCTION public.dd_run_supplier_payout_batch(date) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dd_flag_unshipped_commissions(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dd_handle_order_refund(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.dd_handle_order_chargeback(uuid, bigint) FROM anon;