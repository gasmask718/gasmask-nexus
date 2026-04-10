
-- 1. Account Notes (append-only)
CREATE TABLE public.account_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  note_body text NOT NULL,
  note_type text NOT NULL DEFAULT 'general',
  created_by text,
  ai_summary text,
  ai_action_items text[],
  ai_risk_flags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view notes" ON public.account_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert notes" ON public.account_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update notes" ON public.account_notes FOR UPDATE TO authenticated USING (true);
-- No DELETE policy: append-only for compliance

CREATE INDEX idx_account_notes_entity ON public.account_notes (entity_type, entity_id);
CREATE INDEX idx_account_notes_created ON public.account_notes (created_at DESC);

-- 2. Auto Lenders
CREATE TABLE public.auto_lenders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  lender_type text NOT NULL DEFAULT 'bank',
  min_credit_score integer,
  ideal_credit_score integer,
  min_loan_amount numeric,
  max_loan_amount numeric,
  min_apr numeric,
  max_apr numeric,
  max_ltv_percent numeric,
  max_vehicle_age_years integer,
  max_vehicle_mileage integer,
  new_used_both text DEFAULT 'both',
  payment_method text,
  same_day_funding boolean DEFAULT false,
  preapproval_available boolean DEFAULT false,
  dealer_required boolean DEFAULT false,
  private_party_ok boolean DEFAULT false,
  membership_required boolean DEFAULT false,
  membership_org text,
  membership_cost numeric,
  application_url text,
  phone text,
  funding_timeline_days integer,
  states_available text DEFAULT 'Nationwide',
  application_steps text,
  pro_tips text,
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_lenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view auto lenders" ON public.auto_lenders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert auto lenders" ON public.auto_lenders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update auto lenders" ON public.auto_lenders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete auto lenders" ON public.auto_lenders FOR DELETE TO authenticated USING (true);

-- 3. Shelf Corp Vendors
CREATE TABLE public.shelf_corp_vendors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_name text NOT NULL,
  website_url text,
  price_range_min numeric,
  price_range_max numeric,
  corp_age_years_available text,
  states_offered text[],
  includes_ein boolean DEFAULT false,
  includes_bank_account boolean DEFAULT false,
  includes_credit_history boolean DEFAULT false,
  turn_around_days integer,
  cost_efficiency_score integer,
  trust_score integer,
  verified boolean DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shelf_corp_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view shelf corp vendors" ON public.shelf_corp_vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert shelf corp vendors" ON public.shelf_corp_vendors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update shelf corp vendors" ON public.shelf_corp_vendors FOR UPDATE TO authenticated USING (true);

-- 4. Shelf Corp Tracker
CREATE TABLE public.shelf_corp_tracker (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid,
  vendor_purchased_from text,
  purchase_date date,
  corp_age_at_purchase integer,
  state_of_formation text,
  ein text,
  annual_reports_current boolean DEFAULT false,
  bank_account_opened boolean DEFAULT false,
  bank_name text,
  duns_number text,
  trade_lines_count integer DEFAULT 0,
  business_credit_cards_count integer DEFAULT 0,
  activation_step_current integer DEFAULT 1,
  step_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shelf_corp_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view shelf corp tracker" ON public.shelf_corp_tracker FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert shelf corp tracker" ON public.shelf_corp_tracker FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update shelf corp tracker" ON public.shelf_corp_tracker FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete shelf corp tracker" ON public.shelf_corp_tracker FOR DELETE TO authenticated USING (true);
