-- Phase 20: Real Estate Acquisition & Wholesale System

-- Create enum for acquisition status
CREATE TYPE public.acquisition_status AS ENUM (
  'new',
  'contacted',
  'negotiating',
  'offer_sent',
  'signed',
  'assigned',
  'closed',
  'dead'
);

-- Create enum for property type
CREATE TYPE public.property_type AS ENUM (
  'single_family',
  'multi_family',
  'condo',
  'townhouse',
  'land',
  'commercial',
  'warehouse',
  'mixed_use'
);

-- Create enum for lead source
CREATE TYPE public.lead_source AS ENUM (
  'probate',
  'pre_foreclosure',
  'tax_delinquent',
  'code_violation',
  'mls',
  'expired_listing',
  'fsbo',
  'wholesale_network',
  'zillow',
  'redfin',
  'direct_mail',
  'cold_call'
);

-- Leads Raw Table
CREATE TABLE public.leads_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  county TEXT,
  property_type public.property_type,
  lead_source public.lead_source NOT NULL,
  owner_name TEXT,
  owner_phone TEXT,
  owner_email TEXT,
  bedrooms INTEGER,
  bathrooms NUMERIC,
  square_feet INTEGER,
  lot_size INTEGER,
  year_built INTEGER,
  estimated_value NUMERIC,
  mortgage_balance NUMERIC,
  equity NUMERIC,
  distress_signals JSONB DEFAULT '[]'::jsonb,
  last_sale_date DATE,
  last_sale_price NUMERIC,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Seller Profiles
CREATE TABLE public.seller_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads_raw(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  demographics JSONB,
  distress_level INTEGER DEFAULT 0 CHECK (distress_level BETWEEN 0 AND 100),
  motivation_score INTEGER DEFAULT 0 CHECK (motivation_score BETWEEN 0 AND 100),
  willingness_to_sell INTEGER DEFAULT 0 CHECK (willingness_to_sell BETWEEN 0 AND 100),
  preferred_contact_method TEXT,
  best_time_to_contact TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Lead Scores (AI-generated)
CREATE TABLE public.lead_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads_raw(id) ON DELETE CASCADE,
  motivation_score INTEGER CHECK (motivation_score BETWEEN 0 AND 100),
  offer_likelihood INTEGER CHECK (offer_likelihood BETWEEN 0 AND 100),
  assignment_potential INTEGER CHECK (assignment_potential BETWEEN 0 AND 100),
  hedge_fund_appeal INTEGER CHECK (hedge_fund_appeal BETWEEN 0 AND 100),
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  ai_reasoning TEXT,
  scored_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- AI Comps (Automated Comparative Market Analysis)
CREATE TABLE public.ai_comps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads_raw(id) ON DELETE CASCADE,
  arv NUMERIC, -- After Repair Value
  as_is_value NUMERIC,
  repair_cost NUMERIC,
  offer_price NUMERIC,
  resale_price NUMERIC,
  assignment_fee NUMERIC,
  profit_margin NUMERIC,
  comparable_properties JSONB DEFAULT '[]'::jsonb,
  market_trends JSONB,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Acquisitions Pipeline
CREATE TABLE public.acquisitions_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads_raw(id) ON DELETE CASCADE,
  status public.acquisition_status DEFAULT 'new',
  assigned_to UUID REFERENCES public.profiles(id),
  offer_amount NUMERIC,
  offer_sent_date DATE,
  contract_signed_date DATE,
  closing_date DATE,
  buyer_name TEXT,
  buyer_contact TEXT,
  expected_assignment_fee NUMERIC,
  actual_assignment_fee NUMERIC,
  deal_notes TEXT,
  timeline JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Call Logs (AI Outbound)
CREATE TABLE public.call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads_raw(id) ON DELETE CASCADE,
  caller_id UUID REFERENCES public.profiles(id),
  phone_number TEXT NOT NULL,
  call_duration INTEGER, -- seconds
  call_transcript TEXT,
  sentiment_analysis JSONB,
  outcome TEXT,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_date TIMESTAMP WITH TIME ZONE,
  ai_notes TEXT,
  recording_url TEXT,
  called_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Offer Documents (AI-Generated)
CREATE TABLE public.offer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads_raw(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- LOI, Purchase Agreement, Assignment Contract, etc.
  document_url TEXT,
  generated_by UUID REFERENCES public.profiles(id),
  sent_date TIMESTAMP WITH TIME ZONE,
  viewed BOOLEAN DEFAULT false,
  signed BOOLEAN DEFAULT false,
  signed_date TIMESTAMP WITH TIME ZONE,
  e_signature_data JSONB,
  terms JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Investor Buy Boxes (Hedge Fund Requirements)
CREATE TABLE public.investor_buy_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  min_price NUMERIC,
  max_price NUMERIC,
  preferred_property_types TEXT[] DEFAULT '{}',
  target_zip_codes TEXT[] DEFAULT '{}',
  target_cities TEXT[] DEFAULT '{}',
  target_states TEXT[] DEFAULT '{}',
  min_bedrooms INTEGER,
  min_bathrooms NUMERIC,
  arv_criteria JSONB,
  deal_criteria JSONB,
  subscription_tier TEXT,
  is_active BOOLEAN DEFAULT true,
  priority_level INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Investor Orders (Deals Sent to Buyers)
CREATE TABLE public.investor_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES public.investor_buy_boxes(id),
  lead_id UUID REFERENCES public.leads_raw(id),
  sent_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  viewed BOOLEAN DEFAULT false,
  interested BOOLEAN,
  offer_amount NUMERIC,
  response_notes TEXT,
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Deal Closings
CREATE TABLE public.deal_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acquisition_id UUID REFERENCES public.acquisitions_pipeline(id),
  closing_date DATE NOT NULL,
  title_company TEXT,
  title_company_contact TEXT,
  buyer_name TEXT NOT NULL,
  buyer_entity TEXT,
  purchase_price NUMERIC NOT NULL,
  assignment_fee NUMERIC NOT NULL,
  net_profit NUMERIC,
  closing_costs NUMERIC,
  wire_sent BOOLEAN DEFAULT false,
  wire_received BOOLEAN DEFAULT false,
  commission_paid NUMERIC,
  closing_documents JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Payouts (Revenue Tracking)
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id UUID REFERENCES public.deal_closings(id),
  deal_id UUID REFERENCES public.acquisitions_pipeline(id),
  payout_date DATE,
  assignment_fee NUMERIC NOT NULL,
  commission NUMERIC,
  bonuses NUMERIC,
  expenses NUMERIC,
  net_revenue NUMERIC,
  paid_to UUID REFERENCES public.profiles(id),
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Warehouses Listings
CREATE TABLE public.warehouses_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  square_feet INTEGER,
  price NUMERIC,
  cap_rate NUMERIC,
  annual_rent NUMERIC,
  occupancy_rate NUMERIC,
  zoning TEXT,
  features JSONB,
  investment_analysis JSONB,
  is_opportunity BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Airbnb Candidates
CREATE TABLE public.airbnb_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  bedrooms INTEGER,
  bathrooms NUMERIC,
  daily_rate NUMERIC,
  monthly_revenue NUMERIC,
  yearly_revenue NUMERIC,
  occupancy_rate NUMERIC,
  seasonality_data JSONB,
  comparable_airbnbs JSONB DEFAULT '[]'::jsonb,
  investment_score INTEGER CHECK (investment_score BETWEEN 0 AND 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Land Bank
CREATE TABLE public.land_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  county TEXT,
  acres NUMERIC,
  price NUMERIC,
  price_per_acre NUMERIC,
  zoning TEXT,
  utilities_available TEXT[] DEFAULT '{}',
  appreciation_model JSONB,
  long_term_value NUMERIC,
  development_potential TEXT,
  is_opportunity BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Expansion Cities
CREATE TABLE public.expansion_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  population INTEGER,
  median_home_price NUMERIC,
  median_rent NUMERIC,
  affordability_score INTEGER CHECK (affordability_score BETWEEN 0 AND 100),
  migration_trend TEXT,
  job_growth NUMERIC,
  rent_strength INTEGER CHECK (rent_strength BETWEEN 0 AND 100),
  market_score INTEGER CHECK (market_score BETWEEN 0 AND 100),
  expansion_priority INTEGER DEFAULT 0,
  deployment_status TEXT DEFAULT 'researching',
  ai_analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Real Estate Team
CREATE TABLE public.real_estate_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  role TEXT NOT NULL, -- Analyst, Closer, Manager, Negotiator
  specialization TEXT,
  performance_metrics JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_leads_raw_city_state ON public.leads_raw(city, state);
CREATE INDEX idx_leads_raw_zip ON public.leads_raw(zip_code);
CREATE INDEX idx_leads_raw_source ON public.leads_raw(lead_source);
CREATE INDEX idx_acquisitions_status ON public.acquisitions_pipeline(status);
CREATE INDEX idx_acquisitions_assigned ON public.acquisitions_pipeline(assigned_to);
CREATE INDEX idx_investor_buy_boxes_active ON public.investor_buy_boxes(is_active);
CREATE INDEX idx_deal_closings_date ON public.deal_closings(closing_date);
CREATE INDEX idx_expansion_cities_score ON public.expansion_cities(market_score DESC);

-- RLS Policies
ALTER TABLE public.leads_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_comps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acquisitions_pipeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_buy_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airbnb_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.land_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expansion_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.real_estate_team ENABLE ROW LEVEL SECURITY;

-- Admin can manage all real estate data
CREATE POLICY "Admins manage leads_raw" ON public.leads_raw FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage seller_profiles" ON public.seller_profiles FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage lead_scores" ON public.lead_scores FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage ai_comps" ON public.ai_comps FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage acquisitions" ON public.acquisitions_pipeline FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage call_logs" ON public.call_logs FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage offer_documents" ON public.offer_documents FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage investor_buy_boxes" ON public.investor_buy_boxes FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage investor_orders" ON public.investor_orders FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage deal_closings" ON public.deal_closings FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage payouts" ON public.payouts FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage warehouses" ON public.warehouses_listings FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage airbnb" ON public.airbnb_candidates FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage land_bank" ON public.land_bank FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage expansion" ON public.expansion_cities FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage re_team" ON public.real_estate_team FOR ALL USING (has_role(auth.uid(), 'admin'));

-- System can insert for AI automations
CREATE POLICY "System insert leads_raw" ON public.leads_raw FOR INSERT WITH CHECK (true);
CREATE POLICY "System insert lead_scores" ON public.lead_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "System insert ai_comps" ON public.ai_comps FOR INSERT WITH CHECK (true);
CREATE POLICY "System insert call_logs" ON public.call_logs FOR INSERT WITH CHECK (true);