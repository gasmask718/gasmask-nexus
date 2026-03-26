
-- Add payment columns to ut_orders
ALTER TABLE public.ut_orders 
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS paid_at timestamptz,
ADD COLUMN IF NOT EXISTS supplier_payout_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS vendor_payout_status text DEFAULT 'pending';

-- Create ut_payments table
CREATE TABLE IF NOT EXISTS public.ut_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.ut_orders(id) ON DELETE CASCADE,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  amount numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'usd',
  status text DEFAULT 'pending',
  payment_method text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ut_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to ut_payments" ON public.ut_payments FOR ALL USING (true) WITH CHECK (true);
