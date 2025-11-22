-- Phase 22: Real Estate Funding Desk

-- Lenders
CREATE TABLE IF NOT EXISTS public.lenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_name TEXT NOT NULL,
  lender_type TEXT NOT NULL CHECK (lender_type IN ('hard_money', 'private_money', 'fund', 'institutional', 'bank', 'credit_union')),
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  states_active TEXT[] NOT NULL DEFAULT '{}',
  min_loan_amount NUMERIC,
  max_loan_amount NUMERIC,
  min_credit_score INTEGER,
  max_ltv NUMERIC,
  max_loan_to_cost NUMERIC,
  interest_rate_range TEXT,
  points_range TEXT,
  typical_terms TEXT,
  asset_types TEXT[] DEFAULT '{}',
  speed_to_close_days INTEGER,
  rehab_holdback_available BOOLEAN DEFAULT false,
  notes TEXT,
  rating NUMERIC CHECK (rating >= 0 AND rating <= 5),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lenders_type ON public.lenders(lender_type);
CREATE INDEX idx_lenders_active ON public.lenders(is_active);

-- Loan Products
CREATE TABLE IF NOT EXISTS public.loan_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id UUID NOT NULL REFERENCES public.lenders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_type TEXT NOT NULL CHECK (product_type IN ('hard_money', 'dscr', 'bridge', 'fix_and_flip', 'rental_30yr', 'portfolio', 'cash_out_refi', 'construction')),
  min_loan NUMERIC NOT NULL,
  max_loan NUMERIC NOT NULL,
  min_ltv NUMERIC NOT NULL,
  max_ltv NUMERIC NOT NULL,
  max_loan_to_cost NUMERIC,
  interest_rate_min NUMERIC NOT NULL,
  interest_rate_max NUMERIC NOT NULL,
  origination_points NUMERIC,
  min_credit_score INTEGER,
  min_dscr NUMERIC,
  term_months INTEGER,
  prepayment_penalty TEXT,
  rehab_holdback BOOLEAN DEFAULT false,
  cross_collateral_ok BOOLEAN DEFAULT false,
  states_available TEXT[] DEFAULT '{}',
  property_types TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loan_products_lender ON public.loan_products(lender_id);
CREATE INDEX idx_loan_products_type ON public.loan_products(product_type);
CREATE INDEX idx_loan_products_active ON public.loan_products(is_active);

-- Lender Applications
CREATE TABLE IF NOT EXISTS public.lender_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads_raw(id) ON DELETE CASCADE,
  acquisition_id UUID REFERENCES public.acquisitions_pipeline(id) ON DELETE CASCADE,
  lender_id UUID NOT NULL REFERENCES public.lenders(id) ON DELETE RESTRICT,
  product_id UUID REFERENCES public.loan_products(id) ON DELETE SET NULL,
  loan_amount NUMERIC NOT NULL,
  loan_purpose TEXT NOT NULL,
  property_value NUMERIC,
  purchase_price NUMERIC,
  rehab_budget NUMERIC,
  arv NUMERIC,
  ltv NUMERIC,
  loan_to_cost NUMERIC,
  dscr NUMERIC,
  monthly_rent NUMERIC,
  borrower_credit_score INTEGER,
  borrower_name TEXT,
  borrower_email TEXT,
  borrower_phone TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewing', 'approved', 'conditionally_approved', 'denied', 'funded', 'withdrawn')),
  submitted_at TIMESTAMPTZ,
  decision_date TIMESTAMPTZ,
  notes TEXT,
  underwriter_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lender_applications_lead ON public.lender_applications(lead_id);
CREATE INDEX idx_lender_applications_lender ON public.lender_applications(lender_id);
CREATE INDEX idx_lender_applications_status ON public.lender_applications(status);

-- Loan Underwriting
CREATE TABLE IF NOT EXISTS public.loan_underwriting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.lender_applications(id) ON DELETE CASCADE,
  underwriter_id UUID REFERENCES public.profiles(id),
  property_condition TEXT CHECK (property_condition IN ('excellent', 'good', 'fair', 'poor', 'needs_renovation')),
  comps_verified BOOLEAN DEFAULT false,
  title_clear BOOLEAN DEFAULT false,
  insurance_quoted BOOLEAN DEFAULT false,
  appraisal_value NUMERIC,
  approved_loan_amount NUMERIC,
  approved_rate NUMERIC,
  approved_points NUMERIC,
  approved_term_months INTEGER,
  conditions TEXT[] DEFAULT '{}',
  decision TEXT CHECK (decision IN ('approved', 'approved_with_conditions', 'declined')),
  decision_date TIMESTAMPTZ,
  decision_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loan_underwriting_application ON public.loan_underwriting(application_id);

-- Term Sheets
CREATE TABLE IF NOT EXISTS public.term_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.lender_applications(id) ON DELETE CASCADE,
  term_sheet_number TEXT UNIQUE,
  lender_id UUID NOT NULL REFERENCES public.lenders(id),
  borrower_name TEXT NOT NULL,
  property_address TEXT NOT NULL,
  loan_amount NUMERIC NOT NULL,
  interest_rate NUMERIC NOT NULL,
  origination_points NUMERIC,
  term_months INTEGER NOT NULL,
  ltv NUMERIC,
  dscr NUMERIC,
  conditions TEXT[] DEFAULT '{}',
  expiration_date DATE,
  pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'reviewed', 'accepted', 'declined', 'expired')),
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_term_sheets_application ON public.term_sheets(application_id);
CREATE INDEX idx_term_sheets_status ON public.term_sheets(status);

-- Loan Documents
CREATE TABLE IF NOT EXISTS public.loan_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.lender_applications(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('application', 'term_sheet', 'appraisal', 'title_report', 'insurance', 'credit_report', 'bank_statements', 'tax_returns', 'purchase_contract', 'rehab_scope', 'other')),
  doc_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

CREATE INDEX idx_loan_docs_application ON public.loan_docs(application_id);
CREATE INDEX idx_loan_docs_type ON public.loan_docs(doc_type);

-- Loan Payoffs
CREATE TABLE IF NOT EXISTS public.loan_payoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.lender_applications(id) ON DELETE CASCADE,
  funded_date DATE NOT NULL,
  funded_amount NUMERIC NOT NULL,
  interest_rate NUMERIC NOT NULL,
  term_months INTEGER NOT NULL,
  monthly_payment NUMERIC,
  payoff_date DATE,
  payoff_amount NUMERIC,
  total_interest_paid NUMERIC,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'refinanced', 'defaulted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loan_payoffs_application ON public.loan_payoffs(application_id);
CREATE INDEX idx_loan_payoffs_status ON public.loan_payoffs(status);

-- Loan Analysis Cache
CREATE TABLE IF NOT EXISTS public.loan_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads_raw(id) ON DELETE CASCADE,
  property_value NUMERIC NOT NULL,
  purchase_price NUMERIC NOT NULL,
  rehab_budget NUMERIC,
  arv NUMERIC,
  monthly_rent NUMERIC,
  monthly_expenses NUMERIC,
  dscr NUMERIC,
  ltv NUMERIC,
  loan_to_cost NUMERIC,
  cap_rate NUMERIC,
  max_allowable_loan NUMERIC,
  recommended_strategy TEXT CHECK (recommended_strategy IN ('wholesale', 'fix_and_flip', 'buy_and_hold', 'brrrr', 'development')),
  qualifying_products JSONB DEFAULT '[]'::jsonb,
  ai_analysis TEXT,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loan_analysis_lead ON public.loan_analysis(lead_id);

-- RLS Policies
ALTER TABLE public.lenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lender_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_underwriting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.term_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_analysis ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins manage lenders" ON public.lenders FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage loan products" ON public.loan_products FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage applications" ON public.lender_applications FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage underwriting" ON public.loan_underwriting FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage term sheets" ON public.term_sheets FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage loan docs" ON public.loan_docs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage loan payoffs" ON public.loan_payoffs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage loan analysis" ON public.loan_analysis FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Public read for active lenders and products
CREATE POLICY "Anyone can view active lenders" ON public.lenders FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can view active loan products" ON public.loan_products FOR SELECT USING (is_active = true);