
-- Dynasty Funding Machine — Complete Database Schema
-- Floor 10 of Dynasty OS

-- ============================================
-- CORE CLIENT TABLE
-- ============================================
CREATE TABLE public.funding_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  ssn_last4 TEXT,
  date_of_birth DATE,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  business_name TEXT,
  business_type TEXT,
  business_state TEXT,
  ein TEXT,
  duns_number TEXT,
  time_in_business_months INTEGER DEFAULT 0,
  monthly_revenue DECIMAL DEFAULT 0,
  funding_goal TEXT,
  target_funding_amount DECIMAL DEFAULT 0,
  current_dfs_score INTEGER DEFAULT 0,
  current_funding_ceiling DECIMAL DEFAULT 0,
  projected_funding_ceiling DECIMAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'intake',
  assigned_operator UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view funding clients"
  ON public.funding_clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create funding clients"
  ON public.funding_clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update funding clients"
  ON public.funding_clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete funding clients"
  ON public.funding_clients FOR DELETE TO authenticated USING (true);

-- ============================================
-- CLIENT DOCUMENTS
-- ============================================
CREATE TABLE public.funding_client_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  storage_url TEXT,
  bureau TEXT,
  notes TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_client_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage client documents"
  ON public.funding_client_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- DFS SCORE HISTORY
-- ============================================
CREATE TABLE public.funding_dfs_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  total_score INTEGER NOT NULL DEFAULT 0,
  personal_credit_tu INTEGER DEFAULT 0,
  personal_credit_eq INTEGER DEFAULT 0,
  personal_credit_ex INTEGER DEFAULT 0,
  business_credit_age INTEGER DEFAULT 0,
  tradeline_density INTEGER DEFAULT 0,
  derogatory_count INTEGER DEFAULT 0,
  utilization_ratio INTEGER DEFAULT 0,
  public_records INTEGER DEFAULT 0,
  inquiry_velocity INTEGER DEFAULT 0,
  entity_quality INTEGER DEFAULT 0,
  ein_age INTEGER DEFAULT 0,
  banking_history INTEGER DEFAULT 0,
  revenue_docs INTEGER DEFAULT 0,
  industry_risk INTEGER DEFAULT 0,
  funding_ceiling DECIMAL DEFAULT 0,
  projected_ceiling DECIMAL DEFAULT 0,
  notes TEXT,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_dfs_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage DFS scores"
  ON public.funding_dfs_scores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- INFRASTRUCTURE CHECKLIST
-- ============================================
CREATE TABLE public.funding_infrastructure_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  step_label TEXT NOT NULL,
  step_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  provider TEXT,
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, step_key)
);

ALTER TABLE public.funding_infrastructure_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage infrastructure checklist"
  ON public.funding_infrastructure_checklist FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- MAILBOX CONFIG
-- ============================================
CREATE TABLE public.funding_mailbox_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  account_id TEXT,
  is_monitoring_active BOOLEAN DEFAULT false,
  authorized_users TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_mailbox_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage mailbox config"
  ON public.funding_mailbox_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- CREDIT ITEMS
-- ============================================
CREATE TABLE public.funding_credit_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  bureau TEXT NOT NULL,
  creditor_name TEXT NOT NULL,
  account_number TEXT,
  item_type TEXT NOT NULL,
  balance DECIMAL DEFAULT 0,
  date_of_first_delinquency DATE,
  current_status TEXT DEFAULT 'open',
  estimated_score_impact INTEGER DEFAULT 0,
  deletion_priority INTEGER DEFAULT 0,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolution_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_credit_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage credit items"
  ON public.funding_credit_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- DISPUTE ROUNDS
-- ============================================
CREATE TABLE public.funding_dispute_rounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_item_id UUID NOT NULL REFERENCES public.funding_credit_items(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1,
  letter_type TEXT NOT NULL,
  letter_content TEXT,
  bureau TEXT NOT NULL,
  sent_date DATE,
  response_deadline DATE,
  response_received BOOLEAN DEFAULT false,
  response_date DATE,
  response_result TEXT,
  escalation_needed BOOLEAN DEFAULT false,
  mailing_id UUID,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_dispute_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage dispute rounds"
  ON public.funding_dispute_rounds FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- MAILING LOG
-- ============================================
CREATE TABLE public.funding_mailing_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  dispute_round_id UUID REFERENCES public.funding_dispute_rounds(id),
  recipient_name TEXT,
  recipient_address TEXT,
  mail_type TEXT DEFAULT 'certified',
  tracking_number TEXT,
  sent_date DATE,
  delivery_date DATE,
  delivery_status TEXT DEFAULT 'pending',
  return_receipt_received BOOLEAN DEFAULT false,
  cost DECIMAL DEFAULT 0,
  provider TEXT DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_mailing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage mailing log"
  ON public.funding_mailing_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- TRADELINE ACCOUNTS (Business Credit)
-- ============================================
CREATE TABLE public.funding_tradeline_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  tier INTEGER NOT NULL DEFAULT 1,
  vendor_name TEXT NOT NULL,
  account_type TEXT DEFAULT 'vendor',
  credit_limit DECIMAL DEFAULT 0,
  current_balance DECIMAL DEFAULT 0,
  utilization_pct DECIMAL DEFAULT 0,
  reporting_bureaus TEXT[],
  payment_status TEXT DEFAULT 'current',
  payment_due_date DATE,
  optimal_pay_date DATE,
  paydex_contribution INTEGER DEFAULT 0,
  account_opened_date DATE,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_tradeline_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage tradeline accounts"
  ON public.funding_tradeline_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- CARD DATABASE (Reference)
-- ============================================
CREATE TABLE public.funding_card_database (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'personal',
  primary_bureau TEXT,
  secondary_bureau TEXT,
  min_score_tier1 INTEGER,
  min_score_tier2 INTEGER,
  min_score_tier3 INTEGER,
  min_score_tier4 INTEGER,
  typical_limit_low DECIMAL,
  typical_limit_high DECIMAL,
  has_prequalification BOOLEAN DEFAULT false,
  prequalification_url TEXT,
  zero_apr_months INTEGER DEFAULT 0,
  annual_fee DECIMAL DEFAULT 0,
  reports_to_personal BOOLEAN DEFAULT true,
  reports_to_business BOOLEAN DEFAULT false,
  is_secured BOOLEAN DEFAULT false,
  card_network TEXT DEFAULT 'visa',
  approval_tier INTEGER DEFAULT 2,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_card_database ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cards"
  ON public.funding_card_database FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage cards"
  ON public.funding_card_database FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can update cards"
  ON public.funding_card_database FOR UPDATE TO authenticated USING (true);

-- ============================================
-- LENDER DATABASE (Reference)
-- ============================================
CREATE TABLE public.funding_lender_database (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lender_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  min_credit_score INTEGER DEFAULT 0,
  max_amount DECIMAL DEFAULT 0,
  min_revenue DECIMAL DEFAULT 0,
  min_time_in_business_months INTEGER DEFAULT 0,
  funding_speed TEXT,
  has_soft_pull_prequal BOOLEAN DEFAULT false,
  prequal_url TEXT,
  interest_rate_range TEXT,
  requires_collateral BOOLEAN DEFAULT false,
  requires_tax_returns BOOLEAN DEFAULT false,
  accepts_bank_statements BOOLEAN DEFAULT false,
  direct_deposit BOOLEAN DEFAULT false,
  product_type TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_lender_database ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lenders"
  ON public.funding_lender_database FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage lenders"
  ON public.funding_lender_database FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can update lenders"
  ON public.funding_lender_database FOR UPDATE TO authenticated USING (true);

-- ============================================
-- TASK CARDS
-- ============================================
CREATE TABLE public.funding_task_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'online',
  strategic_rationale TEXT,
  steps JSONB DEFAULT '[]'::jsonb,
  resource_url TEXT,
  resource_address TEXT,
  resource_phone TEXT,
  document_checklist TEXT[],
  time_estimate TEXT,
  deadline DATE,
  delay_consequence TEXT,
  funding_impact INTEGER DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'pending',
  depends_on UUID[],
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  module TEXT,
  sort_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_task_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage task cards"
  ON public.funding_task_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- BANKING VELOCITY
-- ============================================
CREATE TABLE public.funding_banking_velocity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  target_product TEXT,
  month_number INTEGER NOT NULL DEFAULT 1,
  target_avg_daily_balance DECIMAL DEFAULT 0,
  target_monthly_deposits DECIMAL DEFAULT 0,
  target_transaction_count INTEGER DEFAULT 0,
  actual_avg_daily_balance DECIMAL,
  actual_monthly_deposits DECIMAL,
  actual_transaction_count INTEGER,
  is_on_track BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_banking_velocity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage banking velocity"
  ON public.funding_banking_velocity FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- TRADELINE VAULT — CARDHOLDER CARDS
-- ============================================
CREATE TABLE public.funding_tradeline_vault_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cardholder_user_id UUID NOT NULL,
  issuer TEXT NOT NULL,
  account_age_months INTEGER DEFAULT 0,
  credit_limit DECIMAL DEFAULT 0,
  current_utilization DECIMAL DEFAULT 0,
  reporting_bureaus TEXT[],
  available_au_slots INTEGER DEFAULT 0,
  price_per_slot DECIMAL DEFAULT 0,
  statement_close_date INTEGER,
  reporting_date INTEGER,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_tradeline_vault_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage their vault cards"
  ON public.funding_tradeline_vault_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- TRADELINE VAULT — TRANSACTIONS
-- ============================================
CREATE TABLE public.funding_tradeline_vault_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vault_card_id UUID NOT NULL REFERENCES public.funding_tradeline_vault_cards(id) ON DELETE CASCADE,
  buyer_client_id UUID REFERENCES public.funding_clients(id),
  buyer_name TEXT,
  au_added_date DATE,
  expected_reporting_date DATE,
  actual_reporting_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  price DECIMAL DEFAULT 0,
  cardholder_payout DECIMAL DEFAULT 0,
  payout_status TEXT DEFAULT 'unpaid',
  payout_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_tradeline_vault_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage vault transactions"
  ON public.funding_tradeline_vault_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- MORNING BRIEFINGS
-- ============================================
CREATE TABLE public.funding_morning_briefings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_active_clients INTEGER DEFAULT 0,
  clients_summary JSONB DEFAULT '[]'::jsonb,
  alerts JSONB DEFAULT '[]'::jsonb,
  operator_actions JSONB DEFAULT '[]'::jsonb,
  generated_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_morning_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view briefings"
  ON public.funding_morning_briefings FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can create briefings"
  ON public.funding_morning_briefings FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_funding_clients_status ON public.funding_clients(status);
CREATE INDEX idx_funding_clients_operator ON public.funding_clients(assigned_operator);
CREATE INDEX idx_funding_credit_items_client ON public.funding_credit_items(client_id);
CREATE INDEX idx_funding_credit_items_bureau ON public.funding_credit_items(bureau);
CREATE INDEX idx_funding_dispute_rounds_client ON public.funding_dispute_rounds(client_id);
CREATE INDEX idx_funding_dispute_rounds_status ON public.funding_dispute_rounds(status);
CREATE INDEX idx_funding_task_cards_client ON public.funding_task_cards(client_id);
CREATE INDEX idx_funding_task_cards_status ON public.funding_task_cards(status);
CREATE INDEX idx_funding_tradeline_accounts_client ON public.funding_tradeline_accounts(client_id);
CREATE INDEX idx_funding_dfs_scores_client ON public.funding_dfs_scores(client_id);
CREATE INDEX idx_funding_banking_velocity_client ON public.funding_banking_velocity(client_id);

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION public.funding_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER tr_funding_clients_updated_at BEFORE UPDATE ON public.funding_clients FOR EACH ROW EXECUTE FUNCTION public.funding_update_updated_at();
CREATE TRIGGER tr_funding_checklist_updated_at BEFORE UPDATE ON public.funding_infrastructure_checklist FOR EACH ROW EXECUTE FUNCTION public.funding_update_updated_at();
CREATE TRIGGER tr_funding_mailbox_updated_at BEFORE UPDATE ON public.funding_mailbox_config FOR EACH ROW EXECUTE FUNCTION public.funding_update_updated_at();
CREATE TRIGGER tr_funding_credit_items_updated_at BEFORE UPDATE ON public.funding_credit_items FOR EACH ROW EXECUTE FUNCTION public.funding_update_updated_at();
CREATE TRIGGER tr_funding_dispute_rounds_updated_at BEFORE UPDATE ON public.funding_dispute_rounds FOR EACH ROW EXECUTE FUNCTION public.funding_update_updated_at();
CREATE TRIGGER tr_funding_tradeline_accounts_updated_at BEFORE UPDATE ON public.funding_tradeline_accounts FOR EACH ROW EXECUTE FUNCTION public.funding_update_updated_at();
CREATE TRIGGER tr_funding_card_database_updated_at BEFORE UPDATE ON public.funding_card_database FOR EACH ROW EXECUTE FUNCTION public.funding_update_updated_at();
CREATE TRIGGER tr_funding_lender_database_updated_at BEFORE UPDATE ON public.funding_lender_database FOR EACH ROW EXECUTE FUNCTION public.funding_update_updated_at();
CREATE TRIGGER tr_funding_task_cards_updated_at BEFORE UPDATE ON public.funding_task_cards FOR EACH ROW EXECUTE FUNCTION public.funding_update_updated_at();
CREATE TRIGGER tr_funding_banking_velocity_updated_at BEFORE UPDATE ON public.funding_banking_velocity FOR EACH ROW EXECUTE FUNCTION public.funding_update_updated_at();
CREATE TRIGGER tr_funding_vault_cards_updated_at BEFORE UPDATE ON public.funding_tradeline_vault_cards FOR EACH ROW EXECUTE FUNCTION public.funding_update_updated_at();
CREATE TRIGGER tr_funding_vault_transactions_updated_at BEFORE UPDATE ON public.funding_tradeline_vault_transactions FOR EACH ROW EXECUTE FUNCTION public.funding_update_updated_at();
