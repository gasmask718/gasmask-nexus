
-- ============================================================
-- Extend funding_clients with new intake fields
-- ============================================================
ALTER TABLE public.funding_clients
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS ssn_encrypted text,
  ADD COLUMN IF NOT EXISTS email_access_method text DEFAULT 'client_entered',
  ADD COLUMN IF NOT EXISTS employment_status text,
  ADD COLUMN IF NOT EXISTS monthly_income numeric,
  ADD COLUMN IF NOT EXISTS business_start_date text,
  ADD COLUMN IF NOT EXISTS business_state_of_formation text,
  ADD COLUMN IF NOT EXISTS credit_score_estimate integer,
  ADD COLUMN IF NOT EXISTS intake_status text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS assigned_advisor text,
  ADD COLUMN IF NOT EXISTS consent_signed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_signed_at timestamptz;

-- Populate full_name from first_name + last_name where null
UPDATE public.funding_clients SET full_name = COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') WHERE full_name IS NULL;

-- ============================================================
-- credit_unions table
-- ============================================================
CREATE TABLE public.credit_unions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  abbreviation text,
  headquarters_state text,
  national_membership_available boolean DEFAULT false,
  membership_requirement text,
  third_party_membership_org text,
  third_party_membership_cost numeric,
  third_party_membership_url text,
  website_url text,
  application_url text,
  phone text,
  overall_fundability_rank integer,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.credit_unions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view credit unions"
  ON public.credit_unions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage credit unions"
  ON public.credit_unions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin')));

-- ============================================================
-- credit_union_products table
-- ============================================================
CREATE TABLE public.credit_union_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_union_id uuid REFERENCES public.credit_unions(id) ON DELETE CASCADE NOT NULL,
  product_type text NOT NULL,
  product_name text NOT NULL,
  min_loan_amount numeric,
  max_loan_amount numeric,
  min_apr numeric,
  max_apr numeric,
  min_credit_score integer,
  ideal_credit_score integer,
  min_membership_months integer DEFAULT 0,
  income_requirement text,
  dti_max_percent numeric,
  collateral_required boolean DEFAULT false,
  collateral_type text,
  approval_difficulty text DEFAULT 'moderate',
  how_to_apply text,
  application_steps text,
  pro_tips text,
  funding_timeline_days integer,
  reports_to_bureaus text,
  is_credit_builder boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.credit_union_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view credit union products"
  ON public.credit_union_products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage credit union products"
  ON public.credit_union_products FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin')));

-- Indexes
CREATE INDEX idx_cu_products_cu_id ON public.credit_union_products(credit_union_id);
CREATE INDEX idx_cu_products_type ON public.credit_union_products(product_type);
CREATE INDEX idx_cu_products_score ON public.credit_union_products(min_credit_score);
CREATE INDEX idx_cu_products_difficulty ON public.credit_union_products(approval_difficulty);
CREATE INDEX idx_funding_clients_intake_status ON public.funding_clients(intake_status);
