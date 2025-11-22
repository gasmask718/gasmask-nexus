-- Update customer_invoices table with additional fields
ALTER TABLE public.customer_invoices
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax NUMERIC DEFAULT 0,
  DROP COLUMN IF EXISTS total_amount,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ALTER COLUMN status TYPE TEXT,
  DROP CONSTRAINT IF EXISTS customer_invoices_status_check,
  ADD CONSTRAINT customer_invoices_status_check CHECK (status IN ('draft','sent','paid','partial','overdue'));

-- Update customer_receipts table
ALTER TABLE public.customer_receipts
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.customer_invoices(id);

-- Create customer_payment_methods table
CREATE TABLE IF NOT EXISTS public.customer_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  brand TEXT,
  last4 TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  is_default BOOLEAN DEFAULT false
);

-- Create customer_balance table
CREATE TABLE IF NOT EXISTS public.customer_balance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_id UUID NOT NULL UNIQUE REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  outstanding_balance NUMERIC DEFAULT 0,
  last_payment_date DATE,
  last_invoice_date DATE,
  next_due_date DATE
);

-- Create customer_portal_sessions table
CREATE TABLE IF NOT EXISTS public.customer_portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_id UUID NOT NULL REFERENCES public.crm_customers(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_accessed TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_customer ON public.customer_payment_methods(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_balance_customer ON public.customer_balance(customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON public.customer_portal_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_customer ON public.customer_portal_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.customer_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.customer_invoices(due_date);

-- RLS Policies for customer_payment_methods
ALTER TABLE public.customer_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payment methods"
  ON public.customer_payment_methods
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for customer_balance
ALTER TABLE public.customer_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage customer balance"
  ON public.customer_balance
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for customer_portal_sessions
ALTER TABLE public.customer_portal_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view portal sessions"
  ON public.customer_portal_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can manage portal sessions"
  ON public.customer_portal_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to update customer balance
CREATE OR REPLACE FUNCTION public.update_customer_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update or insert customer balance
  INSERT INTO public.customer_balance (customer_id, last_invoice_date, outstanding_balance)
  VALUES (
    NEW.customer_id,
    NEW.invoice_date,
    NEW.total_amount
  )
  ON CONFLICT (customer_id)
  DO UPDATE SET
    last_invoice_date = EXCLUDED.last_invoice_date,
    outstanding_balance = customer_balance.outstanding_balance + EXCLUDED.outstanding_balance,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Trigger to update balance when invoice is created
CREATE TRIGGER trigger_update_balance_on_invoice
  AFTER INSERT ON public.customer_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_balance();

-- Function to update balance on payment
CREATE OR REPLACE FUNCTION public.update_balance_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.customer_balance
  SET 
    outstanding_balance = outstanding_balance - NEW.amount_paid,
    last_payment_date = NEW.receipt_date,
    updated_at = now()
  WHERE customer_id = NEW.customer_id;
  
  RETURN NEW;
END;
$$;

-- Trigger to update balance when receipt is created
CREATE TRIGGER trigger_update_balance_on_payment
  AFTER INSERT ON public.customer_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_balance_on_payment();