
ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS stripe_risk_level text,
  ADD COLUMN IF NOT EXISTS stripe_risk_score int,
  ADD COLUMN IF NOT EXISTS three_ds_authenticated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fraud_review_flag boolean DEFAULT false;

ALTER TABLE public.store_accounts
  ADD COLUMN IF NOT EXISTS identity_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS business_ein text,
  ADD COLUMN IF NOT EXISTS business_verified boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.dd_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  stripe_dispute_id text UNIQUE,
  stripe_charge_id text,
  amount numeric,
  currency text DEFAULT 'usd',
  reason text,
  status text,
  evidence_due_by timestamptz,
  three_ds_authenticated boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_disputes TO authenticated;
GRANT ALL ON public.dd_disputes TO service_role;

ALTER TABLE public.dd_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage disputes" ON public.dd_disputes;
CREATE POLICY "Admins manage disputes"
  ON public.dd_disputes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS dd_disputes_order_id_idx ON public.dd_disputes(order_id);
CREATE INDEX IF NOT EXISTS dd_disputes_status_idx ON public.dd_disputes(status);
CREATE INDEX IF NOT EXISTS marketplace_orders_fraud_flag_idx ON public.marketplace_orders(fraud_review_flag) WHERE fraud_review_flag = true;

CREATE OR REPLACE FUNCTION public.dd_disputes_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS dd_disputes_updated_at ON public.dd_disputes;
CREATE TRIGGER dd_disputes_updated_at
  BEFORE UPDATE ON public.dd_disputes
  FOR EACH ROW EXECUTE FUNCTION public.dd_disputes_set_updated_at();
