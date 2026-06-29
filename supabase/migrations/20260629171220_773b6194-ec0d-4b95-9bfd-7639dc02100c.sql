
CREATE TABLE IF NOT EXISTS public.dd_credit_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  credit_limit numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  available_credit numeric GENERATED ALWAYS AS (credit_limit - current_balance) STORED,
  payment_terms text NOT NULL DEFAULT 'prepay' CHECK (payment_terms IN ('prepay','net15','net30','net60')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','closed')),
  approved_by uuid,
  approved_at timestamptz,
  next_payment_due date,
  days_past_due int NOT NULL DEFAULT 0,
  total_paid_lifetime numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_credit_accounts TO authenticated;
GRANT ALL ON public.dd_credit_accounts TO service_role;

ALTER TABLE public.dd_credit_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access dd_credit_accounts"
  ON public.dd_credit_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Stores view own credit"
  ON public.dd_credit_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_dd_credit_accounts_store ON public.dd_credit_accounts(store_account_id);
CREATE INDEX IF NOT EXISTS idx_dd_credit_accounts_user ON public.dd_credit_accounts(user_id);

CREATE TABLE IF NOT EXISTS public.dd_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_account_id uuid NOT NULL REFERENCES public.dd_credit_accounts(id) ON DELETE CASCADE,
  order_id uuid,
  transaction_type text NOT NULL CHECK (transaction_type IN ('charge','payment','adjustment','refund')),
  amount numeric NOT NULL,
  balance_after numeric,
  notes text,
  due_date date,
  paid_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_credit_transactions TO authenticated;
GRANT ALL ON public.dd_credit_transactions TO service_role;

ALTER TABLE public.dd_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access dd_credit_transactions"
  ON public.dd_credit_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Stores view own transactions"
  ON public.dd_credit_transactions FOR SELECT TO authenticated
  USING (credit_account_id IN (SELECT id FROM public.dd_credit_accounts WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_dd_credit_tx_account ON public.dd_credit_transactions(credit_account_id);

-- charge function
CREATE OR REPLACE FUNCTION public.dd_charge_credit(
  p_user_id uuid,
  p_order_id uuid,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account public.dd_credit_accounts%ROWTYPE;
  v_due_date date;
  v_new_balance numeric;
BEGIN
  SELECT * INTO v_account
  FROM public.dd_credit_accounts
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_credit_account');
  END IF;

  IF v_account.available_credit < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credit',
      'available', v_account.available_credit,
      'requested', p_amount
    );
  END IF;

  v_due_date := CASE v_account.payment_terms
    WHEN 'net15' THEN (now()::date + 15)
    WHEN 'net30' THEN (now()::date + 30)
    WHEN 'net60' THEN (now()::date + 60)
    ELSE now()::date
  END;

  v_new_balance := v_account.current_balance + p_amount;

  UPDATE public.dd_credit_accounts
  SET current_balance = v_new_balance,
      next_payment_due = LEAST(COALESCE(next_payment_due, v_due_date), v_due_date),
      updated_at = now()
  WHERE id = v_account.id;

  INSERT INTO public.dd_credit_transactions (
    credit_account_id, order_id, transaction_type, amount, balance_after, due_date
  ) VALUES (
    v_account.id, p_order_id, 'charge', p_amount, v_new_balance, v_due_date
  );

  RETURN jsonb_build_object(
    'success', true,
    'charged', p_amount,
    'due_date', v_due_date,
    'new_balance', v_new_balance
  );
END;
$$;

-- record payment helper
CREATE OR REPLACE FUNCTION public.dd_record_credit_payment(
  p_credit_account_id uuid,
  p_amount numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account public.dd_credit_accounts%ROWTYPE;
  v_new_balance numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  SELECT * INTO v_account FROM public.dd_credit_accounts WHERE id = p_credit_account_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  v_new_balance := GREATEST(v_account.current_balance - p_amount, 0);

  UPDATE public.dd_credit_accounts
  SET current_balance = v_new_balance,
      total_paid_lifetime = total_paid_lifetime + p_amount,
      days_past_due = CASE WHEN v_new_balance = 0 THEN 0 ELSE days_past_due END,
      next_payment_due = CASE WHEN v_new_balance = 0 THEN NULL ELSE next_payment_due END,
      updated_at = now()
  WHERE id = p_credit_account_id;

  INSERT INTO public.dd_credit_transactions (
    credit_account_id, transaction_type, amount, balance_after, notes, paid_at, created_by
  ) VALUES (
    p_credit_account_id, 'payment', -p_amount, v_new_balance, p_notes, now(), auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;
