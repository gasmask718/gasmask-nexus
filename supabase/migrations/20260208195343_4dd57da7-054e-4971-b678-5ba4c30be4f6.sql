
-- ============================================================
-- WORKER PAY SYSTEM
-- Earnings ledger + Payment payouts + Worker pay config
-- ============================================================

-- Step 1: Add pay_type and pay_rate to production_workers
ALTER TABLE public.production_workers
  ADD COLUMN IF NOT EXISTS pay_type text NOT NULL DEFAULT 'per_batch',
  ADD COLUMN IF NOT EXISTS pay_rate numeric(10,2) NOT NULL DEFAULT 0.00;

-- Step 2: Worker Earnings Ledger (SOURCE OF TRUTH)
CREATE TABLE public.production_worker_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.production_workers(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.production_batches(id) ON DELETE SET NULL,
  submission_id uuid REFERENCES public.production_worker_submissions(id) ON DELETE SET NULL,
  office_id uuid NOT NULL REFERENCES public.production_offices(id) ON DELETE CASCADE,
  
  earnings_amount numeric(10,2) NOT NULL DEFAULT 0.00,
  pay_rate_at_time numeric(10,2) NOT NULL DEFAULT 0.00,
  pay_type_at_time text NOT NULL DEFAULT 'per_batch',
  quantity_completed numeric(10,2) NOT NULL DEFAULT 0,
  unit_type text NOT NULL DEFAULT 'batch',
  
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'disputed')),
  
  earned_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid,
  paid_at timestamptz,
  payment_id uuid,
  
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Step 3: Worker Payments / Payouts
CREATE TABLE public.production_worker_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL REFERENCES public.production_workers(id) ON DELETE CASCADE,
  office_id uuid NOT NULL REFERENCES public.production_offices(id) ON DELETE CASCADE,
  
  total_amount numeric(10,2) NOT NULL DEFAULT 0.00,
  payment_method text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'zelle', 'ach', 'payroll', 'check', 'other')),
  covered_earnings uuid[] NOT NULL DEFAULT '{}',
  
  paid_by uuid NOT NULL,
  admin_notes text,
  
  period_start date,
  period_end date,
  
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Step 4: Indexes
CREATE INDEX idx_earnings_worker ON public.production_worker_earnings(worker_id);
CREATE INDEX idx_earnings_status ON public.production_worker_earnings(status);
CREATE INDEX idx_earnings_office ON public.production_worker_earnings(office_id);
CREATE INDEX idx_earnings_batch ON public.production_worker_earnings(batch_id);
CREATE INDEX idx_earnings_earned_at ON public.production_worker_earnings(earned_at);
CREATE INDEX idx_payments_worker ON public.production_worker_payments(worker_id);
CREATE INDEX idx_payments_paid_at ON public.production_worker_payments(paid_at);

-- Step 5: Auto-update timestamp trigger
CREATE TRIGGER update_worker_earnings_updated_at
  BEFORE UPDATE ON public.production_worker_earnings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Step 6: Enable RLS
ALTER TABLE public.production_worker_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_worker_payments ENABLE ROW LEVEL SECURITY;

-- Step 7: RLS Policies for Earnings

CREATE POLICY "production_earnings_admin_read"
  ON public.production_worker_earnings
  FOR SELECT TO authenticated
  USING (public.has_production_manager_role(auth.uid()));

CREATE POLICY "production_earnings_admin_write"
  ON public.production_worker_earnings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_production_manager_role(auth.uid()));

CREATE POLICY "production_earnings_admin_update"
  ON public.production_worker_earnings
  FOR UPDATE TO authenticated
  USING (public.has_production_manager_role(auth.uid()));

-- Workers read own earnings via person_id → people.owner_id
CREATE POLICY "production_earnings_worker_read_own"
  ON public.production_worker_earnings
  FOR SELECT TO authenticated
  USING (
    worker_id IN (
      SELECT pw.id FROM public.production_workers pw
      JOIN public.people p ON pw.person_id = p.id
      WHERE p.owner_id = auth.uid()
    )
  );

-- Step 8: RLS Policies for Payments

CREATE POLICY "production_payments_admin_read"
  ON public.production_worker_payments
  FOR SELECT TO authenticated
  USING (public.has_production_manager_role(auth.uid()));

CREATE POLICY "production_payments_admin_write"
  ON public.production_worker_payments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_production_manager_role(auth.uid()));

-- Workers read own payments
CREATE POLICY "production_payments_worker_read_own"
  ON public.production_worker_payments
  FOR SELECT TO authenticated
  USING (
    worker_id IN (
      SELECT pw.id FROM public.production_workers pw
      JOIN public.people p ON pw.person_id = p.id
      WHERE p.owner_id = auth.uid()
    )
  );

-- Step 9: Function to create earnings from approved submission
CREATE OR REPLACE FUNCTION public.create_earning_from_submission(
  p_submission_id uuid,
  p_worker_id uuid,
  p_batch_id uuid,
  p_office_id uuid,
  p_quantity numeric,
  p_approved_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay_rate numeric;
  v_pay_type text;
  v_earnings numeric;
  v_earning_id uuid;
BEGIN
  SELECT pay_rate, pay_type INTO v_pay_rate, v_pay_type
  FROM production_workers
  WHERE id = p_worker_id;
  
  IF v_pay_rate IS NULL THEN
    v_pay_rate := 0;
    v_pay_type := 'per_batch';
  END IF;
  
  IF v_pay_type = 'per_unit' THEN
    v_earnings := v_pay_rate * p_quantity;
  ELSE
    v_earnings := v_pay_rate;
  END IF;
  
  INSERT INTO production_worker_earnings (
    worker_id, batch_id, submission_id, office_id,
    earnings_amount, pay_rate_at_time, pay_type_at_time,
    quantity_completed, unit_type, status,
    approved_at, approved_by
  ) VALUES (
    p_worker_id, p_batch_id, p_submission_id, p_office_id,
    v_earnings, v_pay_rate, v_pay_type,
    p_quantity, CASE WHEN v_pay_type = 'per_unit' THEN 'unit' ELSE 'batch' END,
    'approved', now(), p_approved_by
  )
  RETURNING id INTO v_earning_id;
  
  RETURN v_earning_id;
END;
$$;
