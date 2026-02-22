
-- 1) Add dispute columns to marketplace_orders
ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS dispute_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS dispute_reason text,
  ADD COLUMN IF NOT EXISTS dispute_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at timestamptz;

-- 2) Add dispute columns to wholesaler_payouts
ALTER TABLE public.wholesaler_payouts
  ADD COLUMN IF NOT EXISTS dispute_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS liability_amount numeric,
  ADD COLUMN IF NOT EXISTS dispute_linked_order_id uuid REFERENCES public.marketplace_orders(id);

-- 3) Create vendor_liabilities table
CREATE TABLE IF NOT EXISTS public.vendor_liabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.wholesaler_profiles(id),
  order_id uuid REFERENCES public.marketplace_orders(id),
  payout_id uuid REFERENCES public.wholesaler_payouts(id),
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.vendor_liabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/owner can manage vendor liabilities"
  ON public.vendor_liabilities FOR ALL
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Wholesalers can view own liabilities"
  ON public.vendor_liabilities FOR SELECT
  USING (
    vendor_id IN (
      SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid()
    )
  );

-- 4) handle_order_dispute function
CREATE OR REPLACE FUNCTION public.handle_order_dispute(p_order_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update order dispute status
  UPDATE marketplace_orders
  SET dispute_status = 'opened',
      dispute_reason = p_reason,
      dispute_opened_at = now()
  WHERE id = p_order_id
    AND dispute_status = 'none';

  -- Freeze all related payouts
  UPDATE wholesaler_payouts
  SET status = 'held',
      dispute_flag = true,
      hold_reason = p_reason,
      dispute_linked_order_id = p_order_id
  WHERE order_id = p_order_id
    AND status IN ('pending', 'approved_pending_delivery', 'in_settlement', 'approved');
END;
$$;

-- 5) resolve_dispute function
CREATE OR REPLACE FUNCTION public.resolve_dispute(p_order_id uuid, p_outcome text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout RECORD;
BEGIN
  IF p_outcome = 'customer_refund' THEN
    UPDATE marketplace_orders
    SET dispute_status = 'resolved_customer',
        dispute_resolved_at = now()
    WHERE id = p_order_id;

    -- Reverse all held payouts and create liability for already-paid ones
    FOR v_payout IN
      SELECT id, status, net_amount, wholesaler_id
      FROM wholesaler_payouts
      WHERE order_id = p_order_id AND dispute_flag = true
    LOOP
      IF v_payout.status = 'paid' THEN
        -- Already paid: create liability record
        INSERT INTO vendor_liabilities (vendor_id, order_id, payout_id, amount, reason)
        VALUES (v_payout.wholesaler_id, p_order_id, v_payout.id, v_payout.net_amount, 'Customer dispute refund');

        UPDATE wholesaler_payouts
        SET status = 'reversed',
            reversal_reason = 'Customer dispute refund',
            liability_amount = v_payout.net_amount
        WHERE id = v_payout.id;
      ELSE
        UPDATE wholesaler_payouts
        SET status = 'reversed',
            reversal_reason = 'Customer dispute refund'
        WHERE id = v_payout.id;
      END IF;
    END LOOP;

  ELSIF p_outcome = 'vendor_wins' THEN
    UPDATE marketplace_orders
    SET dispute_status = 'resolved_vendor',
        dispute_resolved_at = now()
    WHERE id = p_order_id;

    -- Resume payouts: restore to approved
    UPDATE wholesaler_payouts
    SET status = 'approved',
        dispute_flag = false,
        hold_reason = null,
        approved_at = COALESCE(approved_at, now())
    WHERE order_id = p_order_id
      AND dispute_flag = true
      AND status = 'held';
  END IF;
END;
$$;

-- 6) Update settlement release to skip disputed payouts
CREATE OR REPLACE FUNCTION public.process_settlement_releases()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released_count integer;
BEGIN
  UPDATE wholesaler_payouts
  SET status = 'approved',
      approved_at = now()
  WHERE status = 'in_settlement'
    AND settlement_release_at <= now()
    AND dispute_flag = false;

  GET DIAGNOSTICS released_count = ROW_COUNT;
  RETURN released_count;
END;
$$;
