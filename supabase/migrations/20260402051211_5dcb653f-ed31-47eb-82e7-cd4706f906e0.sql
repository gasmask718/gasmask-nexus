
-- funding_plaid_connections
CREATE TABLE public.funding_plaid_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  item_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  account_id TEXT,
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.funding_plaid_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage plaid connections" ON public.funding_plaid_connections FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- funding_plaid_transactions
CREATE TABLE public.funding_plaid_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.funding_plaid_connections(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  transaction_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  merchant_name TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.funding_plaid_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage plaid transactions" ON public.funding_plaid_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- funding_applications
CREATE TABLE public.funding_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  lender_name TEXT NOT NULL,
  product_type TEXT NOT NULL,
  requested_amount NUMERIC NOT NULL DEFAULT 0,
  approved_amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'Preparing',
  application_date DATE NOT NULL DEFAULT CURRENT_DATE,
  decision_date DATE,
  denial_reason TEXT,
  apr NUMERIC,
  monthly_payment NUMERIC,
  term_months INTEGER,
  remediation_plan TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.funding_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage applications" ON public.funding_applications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- funding_lender_relationships
CREATE TABLE public.funding_lender_relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  institution_name TEXT NOT NULL,
  relationship_types JSONB DEFAULT '[]'::jsonb,
  opened_date DATE,
  balance_range TEXT,
  relationship_strength INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.funding_lender_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage lender relationships" ON public.funding_lender_relationships FOR ALL TO authenticated USING (true) WITH CHECK (true);
