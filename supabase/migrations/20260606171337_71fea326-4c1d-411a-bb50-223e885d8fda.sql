-- ─── wholesaler_profiles additions ─────────────────────────────
ALTER TABLE public.wholesaler_profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_id text,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS reserve_pct numeric NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS margin_pct_override numeric;

CREATE UNIQUE INDEX IF NOT EXISTS wholesaler_profiles_stripe_connect_id_uq
  ON public.wholesaler_profiles(stripe_connect_id) WHERE stripe_connect_id IS NOT NULL;

-- ─── dd_config (singleton row) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dd_config (
  id boolean PRIMARY KEY DEFAULT true,
  default_margin_pct numeric NOT NULL DEFAULT 15,
  default_reserve_pct numeric NOT NULL DEFAULT 8,
  reserve_hold_days integer NOT NULL DEFAULT 45,
  dispute_auto_submit boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT dd_config_singleton CHECK (id = true)
);
INSERT INTO public.dd_config(id) VALUES (true) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.dd_config TO authenticated;
GRANT ALL ON public.dd_config TO service_role;
ALTER TABLE public.dd_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dd_config readable by authed" ON public.dd_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "dd_config admin write" ON public.dd_config FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

-- ─── dd_product_margin_overrides ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.dd_product_margin_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products_all(id) ON DELETE CASCADE,
  margin_pct numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE(product_id)
);
GRANT SELECT ON public.dd_product_margin_overrides TO authenticated;
GRANT ALL ON public.dd_product_margin_overrides TO service_role;
ALTER TABLE public.dd_product_margin_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "margin overrides admin" ON public.dd_product_margin_overrides FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));
CREATE POLICY "margin overrides authed read" ON public.dd_product_margin_overrides FOR SELECT TO authenticated USING (true);

-- ─── dd_split_ledger ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dd_split_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  fulfillment_id uuid REFERENCES public.marketplace_fulfillments(id) ON DELETE SET NULL,
  wholesaler_id uuid NOT NULL REFERENCES public.wholesaler_profiles(id) ON DELETE CASCADE,
  gross_amount_cents bigint NOT NULL DEFAULT 0,
  stripe_fee_cents bigint NOT NULL DEFAULT 0,
  dd_margin_cents bigint NOT NULL DEFAULT 0,
  supplier_transfer_cents bigint NOT NULL DEFAULT 0,
  reserve_held_cents bigint NOT NULL DEFAULT 0,
  reserve_released_cents bigint NOT NULL DEFAULT 0,
  margin_pct_applied numeric,
  reserve_pct_applied numeric,
  stripe_transfer_id text,
  stripe_charge_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','transferred','transfer_failed','reversed','partially_reversed','disputed','frozen'
  )),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fulfillment_id)
);
CREATE INDEX IF NOT EXISTS dd_split_ledger_order_idx ON public.dd_split_ledger(order_id);
CREATE INDEX IF NOT EXISTS dd_split_ledger_wholesaler_idx ON public.dd_split_ledger(wholesaler_id);
CREATE INDEX IF NOT EXISTS dd_split_ledger_charge_idx ON public.dd_split_ledger(stripe_charge_id);

GRANT SELECT, INSERT, UPDATE ON public.dd_split_ledger TO authenticated;
GRANT ALL ON public.dd_split_ledger TO service_role;
ALTER TABLE public.dd_split_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "split ledger admin" ON public.dd_split_ledger FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));
CREATE POLICY "split ledger wholesaler self-read" ON public.dd_split_ledger FOR SELECT TO authenticated
  USING (wholesaler_id IN (SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid()));

-- ─── dd_reserve_ledger ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dd_reserve_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id uuid NOT NULL REFERENCES public.wholesaler_profiles(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  fulfillment_id uuid REFERENCES public.marketplace_fulfillments(id) ON DELETE SET NULL,
  amount_cents bigint NOT NULL,
  release_at timestamptz NOT NULL,
  released_at timestamptz,
  released_transfer_id text,
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','released','clawed_back','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dd_reserve_status_release_idx
  ON public.dd_reserve_ledger(status, release_at);
CREATE INDEX IF NOT EXISTS dd_reserve_wholesaler_idx
  ON public.dd_reserve_ledger(wholesaler_id);

GRANT SELECT ON public.dd_reserve_ledger TO authenticated;
GRANT ALL ON public.dd_reserve_ledger TO service_role;
ALTER TABLE public.dd_reserve_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reserve admin" ON public.dd_reserve_ledger FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));
CREATE POLICY "reserve wholesaler self-read" ON public.dd_reserve_ledger FOR SELECT TO authenticated
  USING (wholesaler_id IN (SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid()));

-- ─── dd_dispute_events ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dd_dispute_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_dispute_id text NOT NULL UNIQUE,
  stripe_charge_id text NOT NULL,
  order_id uuid REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  wholesaler_id uuid REFERENCES public.wholesaler_profiles(id) ON DELETE SET NULL,
  status text NOT NULL,
  reason text,
  amount_cents bigint NOT NULL DEFAULT 0,
  evidence_submitted_at timestamptz,
  evidence_payload jsonb,
  reversed_transfer_id text,
  recovery_steps jsonb DEFAULT '[]'::jsonb,
  raw_event jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dd_dispute_order_idx ON public.dd_dispute_events(order_id);
CREATE INDEX IF NOT EXISTS dd_dispute_wholesaler_idx ON public.dd_dispute_events(wholesaler_id);

GRANT SELECT ON public.dd_dispute_events TO authenticated;
GRANT ALL ON public.dd_dispute_events TO service_role;
ALTER TABLE public.dd_dispute_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disputes admin" ON public.dd_dispute_events FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));
CREATE POLICY "disputes wholesaler self-read" ON public.dd_dispute_events FOR SELECT TO authenticated
  USING (wholesaler_id IN (SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid()));

-- ─── dd_evidence_kit ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dd_evidence_kit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  ip_address text,
  user_agent text,
  accepted_terms_at timestamptz,
  line_items_snapshot jsonb,
  tracking_snapshot jsonb,
  checkout_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);
GRANT SELECT, INSERT, UPDATE ON public.dd_evidence_kit TO authenticated;
GRANT ALL ON public.dd_evidence_kit TO service_role;
ALTER TABLE public.dd_evidence_kit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence admin" ON public.dd_evidence_kit FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));
CREATE POLICY "evidence customer insert" ON public.dd_evidence_kit FOR INSERT TO authenticated
  WITH CHECK (true);

-- ─── Helper: effective margin/reserve resolver ──────────────────
CREATE OR REPLACE FUNCTION public.dd_get_effective_margin_pct(
  p_product_id uuid,
  p_wholesaler_id uuid
) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT margin_pct FROM dd_product_margin_overrides WHERE product_id = p_product_id),
    (SELECT margin_pct_override FROM wholesaler_profiles WHERE id = p_wholesaler_id),
    (SELECT default_margin_pct FROM dd_config WHERE id = true),
    15
  );
$$;

CREATE OR REPLACE FUNCTION public.dd_get_effective_reserve_pct(
  p_wholesaler_id uuid
) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT reserve_pct FROM wholesaler_profiles WHERE id = p_wholesaler_id),
    (SELECT default_reserve_pct FROM dd_config WHERE id = true),
    8
  );
$$;

GRANT EXECUTE ON FUNCTION public.dd_get_effective_margin_pct(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dd_get_effective_reserve_pct(uuid) TO authenticated, service_role;