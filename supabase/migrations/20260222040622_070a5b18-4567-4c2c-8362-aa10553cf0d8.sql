
-- Phase 2B: Safe Payout Engine (fixed roles)

-- 1) Add lifecycle columns to wholesaler_payouts
ALTER TABLE public.wholesaler_payouts
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS hold_reason text,
  ADD COLUMN IF NOT EXISTS reversal_reason text;

-- 2) Create payout audit log table
CREATE TABLE IF NOT EXISTS public.marketplace_payout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id uuid NOT NULL REFERENCES public.wholesaler_payouts(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  old_status text,
  new_status text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_payout_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage payout events"
  ON public.marketplace_payout_events
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Wholesaler can view own payout events"
  ON public.marketplace_payout_events
  FOR SELECT
  TO authenticated
  USING (
    payout_id IN (
      SELECT wp.id FROM public.wholesaler_payouts wp
      JOIN public.wholesaler_profiles wpr ON wpr.id = wp.wholesaler_id
      WHERE wpr.user_id = auth.uid()
    )
  );

-- 3) Trigger: auto-approve payout when fulfillment is marked shipped
CREATE OR REPLACE FUNCTION public.approve_payout_on_shipped()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'shipped' AND (OLD.status IS DISTINCT FROM 'shipped') THEN
    UPDATE public.wholesaler_payouts
    SET status = 'approved',
        approved_at = now()
    WHERE order_id = NEW.order_id
      AND wholesaler_id = NEW.wholesaler_id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_approve_payout_on_shipped ON public.marketplace_fulfillments;
CREATE TRIGGER trg_approve_payout_on_shipped
  AFTER UPDATE ON public.marketplace_fulfillments
  FOR EACH ROW
  EXECUTE FUNCTION public.approve_payout_on_shipped();

-- 4) RLS for wholesaler_payouts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'wholesaler_payouts' AND policyname = 'Wholesaler can view own payouts'
  ) THEN
    EXECUTE 'CREATE POLICY "Wholesaler can view own payouts" ON public.wholesaler_payouts FOR SELECT TO authenticated USING (wholesaler_id IN (SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid()))';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'wholesaler_payouts' AND policyname = 'Admin can manage wholesaler payouts'
  ) THEN
    EXECUTE 'CREATE POLICY "Admin can manage wholesaler payouts" ON public.wholesaler_payouts FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''owner'') OR public.has_role(auth.uid(), ''admin''))';
  END IF;
END $$;
