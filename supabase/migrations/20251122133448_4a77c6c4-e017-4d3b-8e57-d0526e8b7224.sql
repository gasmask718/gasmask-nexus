-- GMA Real Estate Holdings OS Tables

-- Holdings Assets (Main Portfolio)
CREATE TABLE IF NOT EXISTS public.holdings_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_pipeline_id UUID REFERENCES public.acquisitions_pipeline(id),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('single_family', 'multi_family', 'warehouse', 'strip_mall', 'land', 'office', 'mixed_use', 'airbnb_unit')),
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  closing_costs NUMERIC NOT NULL DEFAULT 0,
  rehab_costs NUMERIC NOT NULL DEFAULT 0,
  total_basis NUMERIC GENERATED ALWAYS AS (purchase_price + closing_costs + rehab_costs) STORED,
  current_value NUMERIC NOT NULL DEFAULT 0,
  equity NUMERIC GENERATED ALWAYS AS (current_value - purchase_price - closing_costs - rehab_costs) STORED,
  status TEXT NOT NULL DEFAULT 'owned' CHECK (status IN ('owned', 'under_contract', 'selling', 'sold')),
  hold_strategy TEXT NOT NULL DEFAULT 'long_term_rental' CHECK (hold_strategy IN ('wholesale', 'flip', 'long_term_rental', 'airbnb', 'hybrid')),
  market TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Holdings Loans
CREATE TABLE IF NOT EXISTS public.holdings_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.holdings_assets(id) ON DELETE CASCADE,
  lender_name TEXT NOT NULL,
  loan_type TEXT NOT NULL CHECK (loan_type IN ('hard_money', 'dscr', 'conventional', 'private', 'portfolio', 'heloc')),
  original_balance NUMERIC NOT NULL,
  current_balance NUMERIC NOT NULL,
  interest_rate NUMERIC NOT NULL,
  amortization_years INTEGER,
  monthly_payment_principal_interest NUMERIC NOT NULL,
  escrow_taxes_insurance NUMERIC DEFAULT 0,
  total_monthly_payment NUMERIC GENERATED ALWAYS AS (monthly_payment_principal_interest + COALESCE(escrow_taxes_insurance, 0)) STORED,
  dscr_covenant NUMERIC,
  next_rate_change_date DATE,
  maturity_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'defaulted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Holdings Rent Roll
CREATE TABLE IF NOT EXISTS public.holdings_rent_roll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.holdings_assets(id) ON DELETE CASCADE,
  unit_identifier TEXT NOT NULL,
  tenant_name TEXT,
  tenant_type TEXT NOT NULL CHECK (tenant_type IN ('residential', 'retail', 'office', 'industrial', 'your_own_business')),
  lease_start_date DATE,
  lease_end_date DATE,
  monthly_rent NUMERIC NOT NULL DEFAULT 0,
  deposits_held NUMERIC DEFAULT 0,
  payment_day INTEGER CHECK (payment_day BETWEEN 1 AND 31),
  status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('occupied', 'vacant', 'notice_to_vacate')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Holdings Airbnb Units
CREATE TABLE IF NOT EXISTS public.holdings_airbnb_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.holdings_assets(id) ON DELETE CASCADE,
  listing_name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('airbnb', 'vrbo', 'booking', 'hybrid')),
  nightly_rate_target_low NUMERIC NOT NULL,
  nightly_rate_target_mid NUMERIC NOT NULL,
  nightly_rate_target_high NUMERIC NOT NULL,
  cleaning_fee NUMERIC DEFAULT 0,
  management_fee_percent NUMERIC DEFAULT 0,
  occupancy_target_percent NUMERIC DEFAULT 75,
  estimated_monthly_revenue_conservative NUMERIC,
  estimated_monthly_revenue_base NUMERIC,
  estimated_monthly_revenue_aggressive NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Holdings Expenses
CREATE TABLE IF NOT EXISTS public.holdings_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.holdings_assets(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_type TEXT NOT NULL CHECK (expense_type IN ('taxes', 'insurance', 'utilities', 'repairs', 'capex', 'management_fee', 'cleaning', 'hoa', 'cam', 'misc')),
  description TEXT,
  amount NUMERIC NOT NULL,
  recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Holdings Payments
CREATE TABLE IF NOT EXISTS public.holdings_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.holdings_assets(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('rent', 'airbnb_payout', 'other_income')),
  amount NUMERIC NOT NULL,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Holdings KPIs
CREATE TABLE IF NOT EXISTS public.holdings_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL,
  total_units_owned INTEGER DEFAULT 0,
  portfolio_value NUMERIC DEFAULT 0,
  total_equity NUMERIC DEFAULT 0,
  total_debt NUMERIC DEFAULT 0,
  monthly_income NUMERIC DEFAULT 0,
  monthly_expenses NUMERIC DEFAULT 0,
  net_cashflow NUMERIC DEFAULT 0,
  avg_cap_rate NUMERIC DEFAULT 0,
  avg_dscr NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Holdings Targets
CREATE TABLE IF NOT EXISTS public.holdings_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_cashflow_target NUMERIC NOT NULL,
  portfolio_value_target NUMERIC NOT NULL,
  equity_target NUMERIC NOT NULL,
  timeline_months INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_holdings_assets_status ON public.holdings_assets(status);
CREATE INDEX IF NOT EXISTS idx_holdings_assets_asset_type ON public.holdings_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_holdings_assets_hold_strategy ON public.holdings_assets(hold_strategy);
CREATE INDEX IF NOT EXISTS idx_holdings_loans_asset_id ON public.holdings_loans(asset_id);
CREATE INDEX IF NOT EXISTS idx_holdings_rent_roll_asset_id ON public.holdings_rent_roll(asset_id);
CREATE INDEX IF NOT EXISTS idx_holdings_airbnb_units_asset_id ON public.holdings_airbnb_units(asset_id);
CREATE INDEX IF NOT EXISTS idx_holdings_expenses_asset_id ON public.holdings_expenses(asset_id);
CREATE INDEX IF NOT EXISTS idx_holdings_payments_asset_id ON public.holdings_payments(asset_id);

-- RLS Policies
ALTER TABLE public.holdings_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings_rent_roll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings_airbnb_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings_targets ENABLE ROW LEVEL SECURITY;

-- Admins manage all holdings tables
CREATE POLICY "Admins manage holdings_assets" ON public.holdings_assets FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage holdings_loans" ON public.holdings_loans FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage holdings_rent_roll" ON public.holdings_rent_roll FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage holdings_airbnb_units" ON public.holdings_airbnb_units FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage holdings_expenses" ON public.holdings_expenses FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage holdings_payments" ON public.holdings_payments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage holdings_kpis" ON public.holdings_kpis FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage holdings_targets" ON public.holdings_targets FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_holdings_assets_updated_at BEFORE UPDATE ON public.holdings_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_holdings_loans_updated_at BEFORE UPDATE ON public.holdings_loans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_holdings_rent_roll_updated_at BEFORE UPDATE ON public.holdings_rent_roll FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_holdings_airbnb_units_updated_at BEFORE UPDATE ON public.holdings_airbnb_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_holdings_targets_updated_at BEFORE UPDATE ON public.holdings_targets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();