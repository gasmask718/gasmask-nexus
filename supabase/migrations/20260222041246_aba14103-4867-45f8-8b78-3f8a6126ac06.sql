
-- Phase 2C: 3-Day Delivery Settlement Engine

-- 1) Add settlement columns to wholesaler_payouts
ALTER TABLE public.wholesaler_payouts
  ADD COLUMN IF NOT EXISTS settlement_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS settlement_release_at timestamptz;

-- 2) Replace the shipped trigger with full lifecycle trigger
CREATE OR REPLACE FUNCTION public.update_payout_on_fulfillment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When fulfillment is marked shipped: payout → approved_pending_delivery
  IF NEW.status = 'shipped' AND (OLD.status IS DISTINCT FROM 'shipped') THEN
    UPDATE public.wholesaler_payouts
    SET status = 'approved_pending_delivery'
    WHERE order_id = NEW.order_id
      AND wholesaler_id = NEW.wholesaler_id
      AND status = 'pending';
  END IF;

  -- When fulfillment is marked completed (delivered): payout → in_settlement with 3-day window
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE public.wholesaler_payouts
    SET status = 'in_settlement',
        settlement_start_at = now(),
        settlement_release_at = now() + interval '3 days'
    WHERE order_id = NEW.order_id
      AND wholesaler_id = NEW.wholesaler_id
      AND status = 'approved_pending_delivery';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS trg_approve_payout_on_shipped ON public.marketplace_fulfillments;
DROP TRIGGER IF EXISTS trg_update_payout_on_fulfillment ON public.marketplace_fulfillments;
CREATE TRIGGER trg_update_payout_on_fulfillment
  AFTER UPDATE ON public.marketplace_fulfillments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_payout_on_fulfillment_change();

-- 3) Create the settlement release function (called by cron)
CREATE OR REPLACE FUNCTION public.process_settlement_releases()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released_count integer;
BEGIN
  UPDATE public.wholesaler_payouts
  SET status = 'approved',
      approved_at = now()
  WHERE status = 'in_settlement'
    AND settlement_release_at <= now();

  GET DIAGNOSTICS released_count = ROW_COUNT;
  RETURN released_count;
END;
$$;
