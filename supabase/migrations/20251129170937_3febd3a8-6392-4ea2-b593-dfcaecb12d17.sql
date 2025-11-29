-- Phase 28: Financial Cortex Database Tables

-- Business Transactions
CREATE TABLE public.business_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT,
  entity_type TEXT,
  entity_id UUID,
  brand TEXT,
  region TEXT,
  tags TEXT[],
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Business Expenses
CREATE TABLE public.business_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  vendor TEXT,
  description TEXT,
  payment_method TEXT,
  recurring BOOLEAN DEFAULT false,
  recurring_frequency TEXT,
  brand TEXT,
  department TEXT,
  approved_by UUID,
  receipt_url TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Business Revenue Streams
CREATE TABLE public.business_revenue_streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_name TEXT NOT NULL,
  stream_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  monthly_average NUMERIC DEFAULT 0,
  last_30_days NUMERIC DEFAULT 0,
  growth_rate NUMERIC DEFAULT 0,
  brand TEXT,
  region TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payroll Records
CREATE TABLE public.payroll_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_type TEXT NOT NULL,
  employee_id UUID,
  employee_name TEXT NOT NULL,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  hours_worked NUMERIC DEFAULT 0,
  hourly_rate NUMERIC DEFAULT 0,
  base_pay NUMERIC NOT NULL DEFAULT 0,
  bonuses NUMERIC DEFAULT 0,
  commissions NUMERIC DEFAULT 0,
  deductions NUMERIC DEFAULT 0,
  net_pay NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Production Costs
CREATE TABLE public.production_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  production_date DATE NOT NULL DEFAULT CURRENT_DATE,
  product_type TEXT NOT NULL,
  quantity_produced INTEGER NOT NULL DEFAULT 0,
  material_cost NUMERIC DEFAULT 0,
  labor_cost NUMERIC DEFAULT 0,
  overhead_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC GENERATED ALWAYS AS (CASE WHEN quantity_produced > 0 THEN total_cost / quantity_produced ELSE 0 END) STORED,
  brand TEXT,
  batch_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wholesale Costs
CREATE TABLE public.wholesale_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier TEXT NOT NULL,
  product_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  brand TEXT,
  order_reference TEXT,
  received_date DATE,
  quality_rating INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subscription Expenses
CREATE TABLE public.subscription_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  next_billing_date DATE,
  is_business BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  auto_renew BOOLEAN DEFAULT true,
  cancellation_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Personal Transactions
CREATE TABLE public.personal_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  category TEXT NOT NULL,
  subcategory TEXT,
  merchant TEXT,
  description TEXT,
  payment_method TEXT,
  is_recurring BOOLEAN DEFAULT false,
  tags TEXT[],
  receipt_url TEXT,
  ai_categorized BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Personal Manual Entries
CREATE TABLE public.personal_manual_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('cash', 'card', 'transfer', 'other')),
  category TEXT NOT NULL,
  description TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Financial AI Insights
CREATE TABLE public.financial_ai_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insight_type TEXT NOT NULL,
  insight_category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'opportunity')),
  data JSONB,
  recommendations TEXT[],
  is_business BOOLEAN DEFAULT true,
  user_id UUID,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Financial Forecasts
CREATE TABLE public.financial_forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  forecast_type TEXT NOT NULL,
  forecast_period TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  predicted_revenue NUMERIC DEFAULT 0,
  predicted_expenses NUMERIC DEFAULT 0,
  predicted_profit NUMERIC DEFAULT 0,
  confidence_score INTEGER DEFAULT 50,
  assumptions JSONB,
  is_business BOOLEAN DEFAULT true,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Budget Profiles
CREATE TABLE public.budget_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_name TEXT NOT NULL,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('business', 'personal', 'department', 'project')),
  budget_period TEXT DEFAULT 'monthly',
  total_budget NUMERIC NOT NULL DEFAULT 0,
  category_budgets JSONB DEFAULT '{}',
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Net Worth Snapshots
CREATE TABLE public.networth_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_assets NUMERIC DEFAULT 0,
  total_liabilities NUMERIC DEFAULT 0,
  net_worth NUMERIC GENERATED ALWAYS AS (total_assets - total_liabilities) STORED,
  assets_breakdown JSONB DEFAULT '{}',
  liabilities_breakdown JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.business_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_revenue_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_manual_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.networth_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business tables (admin only)
CREATE POLICY "Admins manage business_transactions" ON public.business_transactions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage business_expenses" ON public.business_expenses FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage business_revenue_streams" ON public.business_revenue_streams FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage payroll_records" ON public.payroll_records FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage production_costs" ON public.production_costs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage wholesale_costs" ON public.wholesale_costs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage subscription_expenses" ON public.subscription_expenses FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage financial_ai_insights" ON public.financial_ai_insights FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage financial_forecasts" ON public.financial_forecasts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage budget_profiles" ON public.budget_profiles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for personal tables (user owns their data)
CREATE POLICY "Users manage own personal_transactions" ON public.personal_transactions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users manage own personal_manual_entries" ON public.personal_manual_entries FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users manage own networth_snapshots" ON public.networth_snapshots FOR ALL USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_business_transactions_date ON public.business_transactions(transaction_date);
CREATE INDEX idx_business_transactions_category ON public.business_transactions(category);
CREATE INDEX idx_business_expenses_date ON public.business_expenses(expense_date);
CREATE INDEX idx_personal_transactions_user ON public.personal_transactions(user_id, transaction_date);
CREATE INDEX idx_financial_ai_insights_status ON public.financial_ai_insights(status, created_at);
CREATE INDEX idx_payroll_records_status ON public.payroll_records(status, pay_period_end);