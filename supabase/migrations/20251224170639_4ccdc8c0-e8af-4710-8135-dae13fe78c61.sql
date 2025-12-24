-- DELIVERY & LOGISTICS - REMAINING TABLES

-- TABLE: store_check_fields (configurable checklist items)
CREATE TABLE public.store_check_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  check_type text NOT NULL,
  field_key text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text',
  required boolean DEFAULT false,
  options_json jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.store_check_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "check_fields_select" ON public.store_check_fields FOR SELECT USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
CREATE POLICY "check_fields_all" ON public.store_check_fields FOR ALL USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- TABLE: store_check_responses
CREATE TABLE public.store_check_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_check_id uuid NOT NULL REFERENCES public.store_checks(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  value_text text,
  value_number numeric,
  value_bool boolean,
  value_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.store_check_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "responses_select" ON public.store_check_responses FOR SELECT USING (store_check_id IN (SELECT id FROM public.store_checks WHERE business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid())));
CREATE POLICY "responses_insert" ON public.store_check_responses FOR INSERT WITH CHECK (store_check_id IN (SELECT id FROM public.store_checks WHERE business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid())));

-- TABLE: rates (for payout calculation)
CREATE TABLE public.delivery_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  worker_type text NOT NULL,
  task_type text NOT NULL,
  base_rate numeric NOT NULL DEFAULT 0,
  bonus_rules_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rates_select" ON public.delivery_rates FOR SELECT USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
CREATE POLICY "rates_all" ON public.delivery_rates FOR ALL USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'finance')));

-- TABLE: worker_payouts
CREATE TABLE public.worker_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  worker_type text NOT NULL,
  worker_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_earned numeric NOT NULL DEFAULT 0,
  adjustments numeric DEFAULT 0,
  debt_withheld numeric DEFAULT 0,
  total_to_pay numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  approved_by_user_id uuid REFERENCES public.profiles(id),
  paid_at timestamptz,
  payout_method text,
  payout_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.worker_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payouts_select" ON public.worker_payouts FOR SELECT USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
CREATE POLICY "payouts_all" ON public.worker_payouts FOR ALL USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'finance')));

-- TABLE: worker_payout_lines
CREATE TABLE public.worker_payout_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payout_id uuid NOT NULL REFERENCES public.worker_payouts(id) ON DELETE CASCADE,
  line_type text NOT NULL,
  ref_id uuid,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.worker_payout_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payout_lines_select" ON public.worker_payout_lines FOR SELECT USING (payout_id IN (SELECT id FROM public.worker_payouts WHERE business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid())));

-- TABLE: driver_debts
CREATE TABLE public.driver_debts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  debt_type text NOT NULL,
  original_amount numeric NOT NULL,
  remaining_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_by_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debts_select" ON public.driver_debts FOR SELECT USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid()));
CREATE POLICY "debts_all" ON public.driver_debts FOR ALL USING (business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'finance')));

-- TABLE: driver_debt_payments
CREATE TABLE public.driver_debt_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debt_id uuid NOT NULL REFERENCES public.driver_debts(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL,
  method text NOT NULL,
  reference text,
  recorded_by_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_debt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debt_payments_select" ON public.driver_debt_payments FOR SELECT USING (debt_id IN (SELECT id FROM public.driver_debts WHERE business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid())));
CREATE POLICY "debt_payments_insert" ON public.driver_debt_payments FOR INSERT WITH CHECK (debt_id IN (SELECT id FROM public.driver_debts WHERE business_id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'finance'))));

-- Indexes
CREATE INDEX idx_store_check_fields_business ON public.store_check_fields(business_id);
CREATE INDEX idx_store_check_responses_check ON public.store_check_responses(store_check_id);
CREATE INDEX idx_worker_payouts_business ON public.worker_payouts(business_id);
CREATE INDEX idx_worker_payouts_worker ON public.worker_payouts(worker_type, worker_id);
CREATE INDEX idx_driver_debts_driver ON public.driver_debts(driver_id);
CREATE INDEX idx_debt_payments_debt ON public.driver_debt_payments(debt_id);