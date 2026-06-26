
-- SURPLUS FUNDS: Contracts
CREATE TABLE IF NOT EXISTS public.surplus_funds_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.surplus_funds_leads(id),
  case_id uuid REFERENCES public.surplus_funds_cases(id),
  claimant_name text NOT NULL,
  claimant_email text,
  claimant_phone text,
  state text NOT NULL CHECK (state IN ('FL','TX','GA','NJ','NY')),
  surplus_amount numeric,
  our_percentage numeric DEFAULT 30,
  contract_type text DEFAULT 'contingency' CHECK (contract_type IN ('contingency','flat_fee')),
  status text DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','signed','expired','cancelled')),
  docusign_envelope_id text,
  hellosign_signature_id text,
  signed_at timestamptz,
  contract_url text,
  storage_path text,
  notes text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surplus_funds_contracts TO authenticated;
GRANT ALL ON public.surplus_funds_contracts TO service_role;
ALTER TABLE public.surplus_funds_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.surplus_funds_contracts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read" ON public.surplus_funds_contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write" ON public.surplus_funds_contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- SURPLUS FUNDS: Payments
CREATE TABLE IF NOT EXISTS public.surplus_funds_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.surplus_funds_cases(id),
  contract_id uuid REFERENCES public.surplus_funds_contracts(id),
  claimant_name text,
  total_surplus_amount numeric,
  our_percentage numeric,
  our_fee_amount numeric,
  attorney_fee_amount numeric,
  claimant_net_amount numeric,
  status text DEFAULT 'pending' CHECK (status IN ('pending','court_ordered','attorney_received','disbursed','our_fee_received')),
  court_order_date date,
  disbursement_date date,
  our_fee_received_date date,
  payment_method text,
  notes text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surplus_funds_payments TO authenticated;
GRANT ALL ON public.surplus_funds_payments TO service_role;
ALTER TABLE public.surplus_funds_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.surplus_funds_payments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read" ON public.surplus_funds_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write" ON public.surplus_funds_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- SURPLUS FUNDS: Attorney assignments
CREATE TABLE IF NOT EXISTS public.surplus_funds_attorney_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES public.surplus_funds_cases(id),
  attorney_id uuid REFERENCES public.surplus_funds_attorneys(id),
  assigned_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','completed')),
  attorney_fee_percentage numeric DEFAULT 33,
  notes text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surplus_funds_attorney_assignments TO authenticated;
GRANT ALL ON public.surplus_funds_attorney_assignments TO service_role;
ALTER TABLE public.surplus_funds_attorney_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.surplus_funds_attorney_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read" ON public.surplus_funds_attorney_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write" ON public.surplus_funds_attorney_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RE: Properties
CREATE TABLE IF NOT EXISTS public.re_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.re_leads(id),
  address text NOT NULL,
  city text,
  state text,
  zip text,
  county text,
  bedrooms int,
  bathrooms numeric,
  sqft int,
  year_built int,
  lot_size_sqft int,
  property_type text CHECK (property_type IN ('sfr','duplex','triplex','fourplex','mobile','land','other')),
  condition text CHECK (condition IN ('excellent','good','fair','poor','teardown')),
  arv_estimate numeric,
  repair_estimate numeric,
  mao numeric,
  asking_price numeric,
  our_offer numeric,
  assignment_fee numeric,
  zillow_url text,
  redfin_url text,
  photos text[] DEFAULT '{}',
  notes text,
  status text DEFAULT 'new' CHECK (status IN ('new','analyzing','offer_sent','under_contract','assigned','closed','dead')),
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_properties TO authenticated;
GRANT ALL ON public.re_properties TO service_role;
ALTER TABLE public.re_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.re_properties FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read" ON public.re_properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write" ON public.re_properties FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RE: Buyer criteria
CREATE TABLE IF NOT EXISTS public.re_buyer_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid REFERENCES public.re_buyers(id),
  states text[] DEFAULT '{}',
  cities text[] DEFAULT '{}',
  property_types text[] DEFAULT '{}',
  min_beds int DEFAULT 2,
  max_price numeric,
  min_arv numeric,
  max_arv numeric,
  condition_acceptable text[] DEFAULT '{"fair","poor","teardown"}',
  max_repair_cost numeric,
  notes text,
  active bool DEFAULT true,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_buyer_criteria TO authenticated;
GRANT ALL ON public.re_buyer_criteria TO service_role;
ALTER TABLE public.re_buyer_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.re_buyer_criteria FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read" ON public.re_buyer_criteria FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write" ON public.re_buyer_criteria FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RE: Offers
CREATE TABLE IF NOT EXISTS public.re_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.re_properties(id),
  buyer_id uuid REFERENCES public.re_buyers(id),
  offer_amount numeric NOT NULL,
  assignment_fee numeric,
  status text DEFAULT 'sent' CHECK (status IN ('sent','viewed','accepted','countered','declined','expired')),
  sent_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_offers TO authenticated;
GRANT ALL ON public.re_offers TO service_role;
ALTER TABLE public.re_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.re_offers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read" ON public.re_offers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write" ON public.re_offers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RE: Contracts
CREATE TABLE IF NOT EXISTS public.re_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.re_properties(id),
  deal_id uuid REFERENCES public.re_deals(id),
  contract_type text CHECK (contract_type IN ('purchase_agreement','assignment_agreement')),
  seller_name text,
  buyer_name text,
  purchase_price numeric,
  assignment_fee numeric,
  closing_date date,
  status text DEFAULT 'draft' CHECK (status IN ('draft','sent','signed','expired','cancelled')),
  docusign_envelope_id text,
  signed_at timestamptz,
  contract_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_contracts TO authenticated;
GRANT ALL ON public.re_contracts TO service_role;
ALTER TABLE public.re_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.re_contracts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read" ON public.re_contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write" ON public.re_contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RE: VA tasks
CREATE TABLE IF NOT EXISTS public.re_va_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.re_leads(id),
  property_id uuid REFERENCES public.re_properties(id),
  va_profile_id uuid REFERENCES public.re_va_profiles(id),
  task_type text CHECK (task_type IN ('follow_up_call','appointment_set','property_research','comps_pull','seller_callback','contract_follow_up','other')),
  priority text DEFAULT 'normal' CHECK (priority IN ('urgent','high','normal','low')),
  status text DEFAULT 'queued' CHECK (status IN ('queued','in_progress','completed','escalated','cancelled')),
  notes text,
  script text,
  due_at timestamptz,
  completed_at timestamptz,
  escalated_to text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.re_va_tasks TO authenticated;
GRANT ALL ON public.re_va_tasks TO service_role;
ALTER TABLE public.re_va_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.re_va_tasks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read" ON public.re_va_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated write" ON public.re_va_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Section 12: increment RPC for call_count (overloaded names to avoid collision)
CREATE OR REPLACE FUNCTION public.increment_call_count(row_id uuid, target_table text DEFAULT 'dc_leads')
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count int;
BEGIN
  IF target_table = 'surplus_funds_leads' THEN
    UPDATE public.surplus_funds_leads SET call_count = COALESCE(call_count,0) + 1
      WHERE id = row_id RETURNING call_count INTO current_count;
  ELSIF target_table = 're_leads' THEN
    UPDATE public.re_leads SET call_count = COALESCE(call_count,0) + 1
      WHERE id = row_id RETURNING call_count INTO current_count;
  ELSIF target_table = 'dc_leads' THEN
    UPDATE public.dc_leads SET call_count = COALESCE(call_count,0) + 1
      WHERE id = row_id RETURNING call_count INTO current_count;
  END IF;
  RETURN current_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_call_count(uuid, text) TO authenticated, service_role;
