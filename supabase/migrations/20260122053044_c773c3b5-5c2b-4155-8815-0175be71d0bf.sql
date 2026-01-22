-- =============================================
-- COMMISSION ENGINE SCHEMA (AUTHORITATIVE)
-- Rule: Nothing computes commissions twice. Nothing edits history. Ever.
-- =============================================

-- HELPER FUNCTION: Check if current user is elevated
CREATE OR REPLACE FUNCTION public.is_elevated_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('owner', 'admin', 'accountant', 'employee')
  )
$$;

-- 1️⃣ commission_plans: Policy layer (who earns what)
CREATE TABLE public.commission_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  applies_to text NOT NULL CHECK (applies_to IN ('store', 'wholesale', 'affiliate', 'team')),
  default_rate numeric(5,2),
  is_stackable boolean DEFAULT false,
  effective_from date NOT NULL,
  effective_to date,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2️⃣ commission_rules: Eligibility logic per plan
CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_plan_id uuid REFERENCES public.commission_plans(id) ON DELETE CASCADE,
  source_channel text NOT NULL CHECK (source_channel IN ('store_order', 'wholesale_order', 'affiliate', 'team_override')),
  min_gross_amount numeric(10,2),
  max_gross_amount numeric(10,2),
  rate_override numeric(5,2),
  flat_bonus numeric(10,2),
  created_at timestamptz DEFAULT now()
);

-- 3️⃣ commission_ledger: SACRED - Money history (immutable)
CREATE TABLE public.commission_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id),
  store_id uuid REFERENCES public.store_master(id),
  source_channel text NOT NULL CHECK (source_channel IN ('store_order', 'wholesale_order', 'affiliate', 'team_override')),
  source_id uuid NOT NULL,
  gross_amount numeric(10,2) NOT NULL,
  commission_rate numeric(5,2) NOT NULL,
  commission_amount numeric(10,2) NOT NULL,
  commission_plan_id uuid REFERENCES public.commission_plans(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'reversed')),
  earned_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  paid_at timestamptz,
  reversal_of uuid REFERENCES public.commission_ledger(id),
  created_at timestamptz DEFAULT now()
);

-- 4️⃣ commission_payout_batches: Groups ledger rows into payouts
CREATE TABLE public.commission_payout_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 5️⃣ commission_payout_items: Immutable join (prevents double-paying)
CREATE TABLE public.commission_payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_batch_id uuid REFERENCES public.commission_payout_batches(id) ON DELETE CASCADE,
  commission_ledger_id uuid REFERENCES public.commission_ledger(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (payout_batch_id, commission_ledger_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_commission_ledger_ambassador ON public.commission_ledger(ambassador_id);
CREATE INDEX idx_commission_ledger_store ON public.commission_ledger(store_id);
CREATE INDEX idx_commission_ledger_status ON public.commission_ledger(status);
CREATE INDEX idx_commission_ledger_earned_at ON public.commission_ledger(earned_at);
CREATE INDEX idx_commission_ledger_source ON public.commission_ledger(source_channel, source_id);
CREATE INDEX idx_commission_payout_batches_ambassador ON public.commission_payout_batches(ambassador_id);
CREATE INDEX idx_commission_rules_plan ON public.commission_rules(commission_plan_id);

-- =============================================
-- ENABLE RLS
-- =============================================
ALTER TABLE public.commission_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payout_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- commission_plans
CREATE POLICY "Anyone can read active commission plans"
ON public.commission_plans FOR SELECT USING (active = true);

CREATE POLICY "Elevated users manage commission plans"
ON public.commission_plans FOR ALL USING (public.is_elevated_user());

-- commission_rules
CREATE POLICY "Anyone can read commission rules for active plans"
ON public.commission_rules FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.commission_plans cp 
  WHERE cp.id = commission_plan_id AND cp.active = true
));

CREATE POLICY "Elevated users manage commission rules"
ON public.commission_rules FOR ALL USING (public.is_elevated_user());

-- commission_ledger
CREATE POLICY "Ambassadors read own ledger entries"
ON public.commission_ledger FOR SELECT
USING (ambassador_id = public.get_ambassador_id(auth.uid()));

CREATE POLICY "Elevated users manage commission ledger"
ON public.commission_ledger FOR ALL USING (public.is_elevated_user());

-- commission_payout_batches
CREATE POLICY "Ambassadors read own payout batches"
ON public.commission_payout_batches FOR SELECT
USING (ambassador_id = public.get_ambassador_id(auth.uid()));

CREATE POLICY "Elevated users manage payout batches"
ON public.commission_payout_batches FOR ALL USING (public.is_elevated_user());

-- commission_payout_items
CREATE POLICY "Ambassadors read own payout items"
ON public.commission_payout_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.commission_payout_batches cpb
  WHERE cpb.id = payout_batch_id 
  AND cpb.ambassador_id = public.get_ambassador_id(auth.uid())
));

CREATE POLICY "Elevated users manage payout items"
ON public.commission_payout_items FOR ALL USING (public.is_elevated_user());

-- =============================================
-- IMMUTABILITY PROTECTION TRIGGERS
-- =============================================
CREATE OR REPLACE FUNCTION public.prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.gross_amount != NEW.gross_amount 
       OR OLD.commission_rate != NEW.commission_rate 
       OR OLD.commission_amount != NEW.commission_amount
       OR OLD.ambassador_id != NEW.ambassador_id
       OR OLD.source_id != NEW.source_id THEN
      RAISE EXCEPTION 'Commission ledger amounts and attribution are immutable. Create a reversal instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_commission_ledger_immutability
BEFORE UPDATE ON public.commission_ledger
FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();

CREATE OR REPLACE FUNCTION public.prevent_ledger_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Commission ledger entries cannot be deleted. Create a reversal instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_commission_ledger_no_delete
BEFORE DELETE ON public.commission_ledger
FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_delete();