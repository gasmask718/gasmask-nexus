-- ── config knobs ──────────────────────────────────────────────────────────
ALTER TABLE public.dd_config
  ADD COLUMN IF NOT EXISTS signature_required_above numeric NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS insurance_required_above numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS inr_no_scan_days integer NOT NULL DEFAULT 7;

-- ── label protection actually bought ──────────────────────────────────────
ALTER TABLE public.dd_shipments
  ADD COLUMN IF NOT EXISTS signature_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signature_confirmation text,
  ADD COLUMN IF NOT EXISTS insured_amount numeric,
  ADD COLUMN IF NOT EXISTS declared_value numeric,
  ADD COLUMN IF NOT EXISTS protection_note text;

-- ── supplier scorecard: wrong-address / warehouse errors ──────────────────
ALTER TABLE public.dd_supplier_metrics
  ADD COLUMN IF NOT EXISTS fulfillment_errors integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inr_claims_total integer NOT NULL DEFAULT 0;

-- ── the claim itself ──────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.dd_inr_number_seq START 1000;

CREATE TABLE IF NOT EXISTS public.dd_inr_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number text NOT NULL DEFAULT ('INR-' || nextval('public.dd_inr_number_seq')),
  order_id uuid NOT NULL,
  shipment_id uuid,
  user_id uuid,
  customer_email text NOT NULL,
  wholesaler_id uuid,

  -- what the customer told us
  expected_delivery_date date,
  checked_with_neighbours boolean NOT NULL DEFAULT false,
  checked_notes text,
  customer_stated_address jsonb,
  customer_note text,

  -- carrier evidence pulled at intake (step 2)
  tracking_number text,
  carrier text,
  tracking_status text,
  tracking_last_scan_at timestamptz,
  tracking_last_scan_location text,
  tracking_delivered_at timestamptz,
  tracking_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  tracking_raw jsonb,
  tracking_fetch_error text,
  evidence_gathered_at timestamptz,
  signature_on_file boolean NOT NULL DEFAULT false,

  -- verdict + path
  verdict text NOT NULL DEFAULT 'unknown'
    CHECK (verdict IN ('delivered','lost_or_stuck','no_scan','wrong_address','unknown')),
  recommended_path text NOT NULL DEFAULT 'review'
    CHECK (recommended_path IN ('a_delivered_absorb','b_carrier_claim','c_wholesaler_fault','review')),
  chosen_path text
    CHECK (chosen_path IS NULL OR chosen_path IN ('a_delivered_absorb','b_carrier_claim','c_wholesaler_fault')),
  address_mismatch boolean NOT NULL DEFAULT false,
  address_mismatch_detail jsonb,

  fault_party text NOT NULL DEFAULT 'unassigned'
    CHECK (fault_party IN ('unassigned','carrier','wholesaler','customer','dynasty')),

  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','evidence_gathered','refunded','reshipped','carrier_claim_filed','declined','closed')),

  order_total_cents integer NOT NULL DEFAULT 0,
  refund_amount_cents integer,
  stripe_refund_id text,
  split_reversal_id uuid,
  clawback_id uuid,
  reship_order_id uuid,
  declined_reason text,
  admin_notes text,

  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dd_inr_claims_number_key ON public.dd_inr_claims (claim_number);
CREATE INDEX IF NOT EXISTS dd_inr_claims_order_idx ON public.dd_inr_claims (order_id);
CREATE INDEX IF NOT EXISTS dd_inr_claims_email_idx ON public.dd_inr_claims (lower(customer_email));
CREATE INDEX IF NOT EXISTS dd_inr_claims_status_idx ON public.dd_inr_claims (status, created_at DESC);

GRANT SELECT ON public.dd_inr_claims TO authenticated;
GRANT ALL ON public.dd_inr_claims TO service_role;
ALTER TABLE public.dd_inr_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read INR claims" ON public.dd_inr_claims
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE POLICY "Service role manages INR claims" ON public.dd_inr_claims
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── carrier claims ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dd_inr_carrier_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inr_claim_id uuid NOT NULL REFERENCES public.dd_inr_claims(id) ON DELETE CASCADE,
  order_id uuid,
  shipment_id uuid,
  carrier text,
  tracking_number text,
  claim_reference text,
  declared_value_cents integer NOT NULL DEFAULT 0,
  amount_claimed_cents integer NOT NULL DEFAULT 0,
  amount_recovered_cents integer NOT NULL DEFAULT 0,
  insurance_purchased boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'filed'
    CHECK (status IN ('filed','submitted','approved','denied','paid','abandoned')),
  filed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dd_inr_carrier_claims TO authenticated;
GRANT ALL ON public.dd_inr_carrier_claims TO service_role;
ALTER TABLE public.dd_inr_carrier_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read carrier claims" ON public.dd_inr_carrier_claims
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner'));

CREATE POLICY "Service role manages carrier claims" ON public.dd_inr_carrier_claims
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── disputes carry the evidence forward ───────────────────────────────────
ALTER TABLE public.dd_disputes
  ADD COLUMN IF NOT EXISTS inr_claim_id uuid,
  ADD COLUMN IF NOT EXISTS tracking_evidence jsonb;

-- ── repeat-claim risk (customer + address level) ──────────────────────────
CREATE OR REPLACE VIEW public.v_dd_inr_customer_risk
WITH (security_invoker = true) AS
SELECT
  lower(c.customer_email)                                   AS customer_email,
  count(*)                                                  AS claims_total,
  count(*) FILTER (WHERE c.verdict = 'delivered')           AS claims_marked_delivered,
  count(*) FILTER (WHERE c.status = 'refunded')             AS claims_refunded,
  coalesce(sum(c.refund_amount_cents), 0)                   AS refunded_cents,
  max(c.created_at)                                         AS last_claim_at,
  count(DISTINCT coalesce(
    lower(c.customer_stated_address->>'zip'), 'unknown'))   AS distinct_zips
FROM public.dd_inr_claims c
GROUP BY lower(c.customer_email);

GRANT SELECT ON public.v_dd_inr_customer_risk TO authenticated;

-- ── updated_at triggers ───────────────────────────────────────────────────
CREATE TRIGGER dd_inr_claims_touch
  BEFORE UPDATE ON public.dd_inr_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER dd_inr_carrier_claims_touch
  BEFORE UPDATE ON public.dd_inr_carrier_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();