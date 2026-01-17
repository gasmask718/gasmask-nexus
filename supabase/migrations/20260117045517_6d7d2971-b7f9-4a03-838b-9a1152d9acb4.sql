
-- =====================================================
-- WHOLESALER RELATIONSHIP INTELLIGENCE COCKPIT SCHEMA
-- =====================================================

-- 1. Extend wholesalers table with new intelligence fields
ALTER TABLE public.wholesalers
ADD COLUMN IF NOT EXISTS legal_business_name TEXT,
ADD COLUMN IF NOT EXISTS dba_name TEXT,
ADD COLUMN IF NOT EXISTS backup_contact_name TEXT,
ADD COLUMN IF NOT EXISTS backup_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS role_type TEXT DEFAULT 'primary', -- primary, backup, specialty, regional
ADD COLUMN IF NOT EXISTS authorized_brands TEXT[], -- array of brand slugs
ADD COLUMN IF NOT EXISTS sku_permissions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS pricing_tier TEXT DEFAULT 'standard', -- standard, premium, vip, wholesale
ADD COLUMN IF NOT EXISTS margin_agreement DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS moq INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS reorder_threshold INTEGER,
ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT 'net30', -- cod, net15, net30, net45, net60
ADD COLUMN IF NOT EXISTS compliance_documents JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS license_number TEXT,
ADD COLUMN IF NOT EXISTS license_expiry DATE,
ADD COLUMN IF NOT EXISTS resale_cert_number TEXT,
ADD COLUMN IF NOT EXISTS resale_cert_expiry DATE,
ADD COLUMN IF NOT EXISTS insurance_policy TEXT,
ADD COLUMN IF NOT EXISTS insurance_expiry DATE,
ADD COLUMN IF NOT EXISTS tax_id TEXT,
ADD COLUMN IF NOT EXISTS territories TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS exclusive_zones TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS assigned_rep_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS last_visit_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS visit_frequency_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS relationship_health_score INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS health_score_updated_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'low', -- low, medium, high, critical
ADD COLUMN IF NOT EXISTS risk_flags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS contract_start_date DATE,
ADD COLUMN IF NOT EXISTS contract_end_date DATE,
ADD COLUMN IF NOT EXISTS growth_target_percentage DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS incentives JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS penalties JSONB DEFAULT '[]'::jsonb;

-- 2. Create wholesaler_orders table for tracking all order data
CREATE TABLE IF NOT EXISTS public.wholesaler_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wholesaler_id UUID NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  order_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  order_number TEXT,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  items_count INTEGER DEFAULT 0,
  skus JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending', -- pending, confirmed, shipped, delivered, cancelled
  payment_status TEXT DEFAULT 'unpaid', -- unpaid, partial, paid, overdue
  payment_received_date TIMESTAMPTZ,
  days_to_payment INTEGER,
  delivery_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create wholesaler_payments table for tracking payment behavior
CREATE TABLE IF NOT EXISTS public.wholesaler_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wholesaler_id UUID NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.wholesaler_orders(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_method TEXT, -- cash, check, wire, ach, credit
  days_from_invoice INTEGER,
  on_time BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create wholesaler_disputes table for tracking issues
CREATE TABLE IF NOT EXISTS public.wholesaler_disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wholesaler_id UUID NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.wholesaler_orders(id) ON DELETE SET NULL,
  dispute_type TEXT NOT NULL, -- quality, quantity, pricing, delivery, payment
  description TEXT,
  severity TEXT DEFAULT 'low', -- low, medium, high, critical
  status TEXT DEFAULT 'open', -- open, investigating, resolved, escalated
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution_days INTEGER,
  resolution_notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  resolved_by UUID REFERENCES public.profiles(id)
);

-- 5. Create wholesaler_visits table for field tracking
CREATE TABLE IF NOT EXISTS public.wholesaler_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wholesaler_id UUID NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  visit_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  visited_by UUID REFERENCES public.profiles(id),
  visit_type TEXT DEFAULT 'routine', -- routine, sales, issue, introduction, audit
  duration_minutes INTEGER,
  observations TEXT,
  visibility_score INTEGER, -- 1-10 product visibility
  placement_feedback TEXT,
  issues_found JSONB DEFAULT '[]'::jsonb,
  opportunities JSONB DEFAULT '[]'::jsonb,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_notes TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Create wholesaler_communications table for relationship memory
CREATE TABLE IF NOT EXISTS public.wholesaler_communications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wholesaler_id UUID NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  communication_type TEXT NOT NULL, -- call, email, text, visit, meeting
  direction TEXT DEFAULT 'outbound', -- inbound, outbound
  subject TEXT,
  summary TEXT,
  promises_made JSONB DEFAULT '[]'::jsonb,
  promises_kept BOOLEAN,
  sentiment TEXT DEFAULT 'neutral', -- positive, neutral, negative, escalated
  communicated_by UUID REFERENCES public.profiles(id),
  communicated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_task_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Create wholesaler_territory_coverage table
CREATE TABLE IF NOT EXISTS public.wholesaler_territory_coverage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wholesaler_id UUID NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  neighborhood TEXT NOT NULL,
  borough TEXT,
  store_count INTEGER DEFAULT 0,
  coverage_density TEXT DEFAULT 'low', -- low, medium, high
  is_exclusive BOOLEAN DEFAULT false,
  overlap_with JSONB DEFAULT '[]'::jsonb, -- other wholesaler IDs
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(wholesaler_id, neighborhood)
);

-- 8. Create wholesaler_product_performance table
CREATE TABLE IF NOT EXISTS public.wholesaler_product_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wholesaler_id UUID NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  product_id UUID,
  sku TEXT,
  product_name TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  units_sold INTEGER DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0,
  returns_count INTEGER DEFAULT 0,
  return_rate DECIMAL(5,2) DEFAULT 0,
  velocity_score INTEGER DEFAULT 0, -- 1-100
  substitution_rate DECIMAL(5,2) DEFAULT 0,
  price_erosion_percent DECIMAL(5,2) DEFAULT 0,
  neighborhoods_sold TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Create wholesaler_health_snapshots for trend tracking
CREATE TABLE IF NOT EXISTS public.wholesaler_health_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wholesaler_id UUID NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  health_score INTEGER NOT NULL,
  order_consistency_score INTEGER,
  payment_punctuality_score INTEGER,
  communication_score INTEGER,
  dispute_score INTEGER,
  contract_adherence_score INTEGER,
  price_sensitivity_score INTEGER,
  trend TEXT DEFAULT 'stable', -- improving, stable, declining
  risk_factors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(wholesaler_id, snapshot_date)
);

-- 10. Create wholesaler_ai_signals table for predictive alerts
CREATE TABLE IF NOT EXISTS public.wholesaler_ai_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wholesaler_id UUID NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL, -- frequency_drop, territory_underperformance, payment_risk, competitive_displacement, growth_opportunity
  severity TEXT DEFAULT 'info', -- info, warning, critical
  headline TEXT NOT NULL,
  details TEXT,
  recommended_action TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Create wholesaler_contracts table for agreement tracking
CREATE TABLE IF NOT EXISTS public.wholesaler_contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wholesaler_id UUID NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  contract_name TEXT NOT NULL,
  contract_type TEXT DEFAULT 'standard', -- standard, exclusive, trial, performance
  start_date DATE NOT NULL,
  end_date DATE,
  auto_renew BOOLEAN DEFAULT false,
  terms JSONB DEFAULT '{}'::jsonb,
  exclusivity_clauses TEXT[],
  incentive_structure JSONB DEFAULT '{}'::jsonb,
  penalty_structure JSONB DEFAULT '{}'::jsonb,
  growth_targets JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active', -- draft, active, expiring, expired, terminated
  document_url TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.wholesaler_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesaler_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesaler_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesaler_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesaler_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesaler_territory_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesaler_product_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesaler_health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesaler_ai_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesaler_contracts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users
CREATE POLICY "wholesaler_orders_read" ON public.wholesaler_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "wholesaler_orders_insert" ON public.wholesaler_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wholesaler_orders_update" ON public.wholesaler_orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "wholesaler_orders_delete" ON public.wholesaler_orders FOR DELETE TO authenticated USING (true);

CREATE POLICY "wholesaler_payments_read" ON public.wholesaler_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "wholesaler_payments_insert" ON public.wholesaler_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wholesaler_payments_update" ON public.wholesaler_payments FOR UPDATE TO authenticated USING (true);

CREATE POLICY "wholesaler_disputes_read" ON public.wholesaler_disputes FOR SELECT TO authenticated USING (true);
CREATE POLICY "wholesaler_disputes_insert" ON public.wholesaler_disputes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wholesaler_disputes_update" ON public.wholesaler_disputes FOR UPDATE TO authenticated USING (true);

CREATE POLICY "wholesaler_visits_read" ON public.wholesaler_visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "wholesaler_visits_insert" ON public.wholesaler_visits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wholesaler_visits_update" ON public.wholesaler_visits FOR UPDATE TO authenticated USING (true);

CREATE POLICY "wholesaler_communications_read" ON public.wholesaler_communications FOR SELECT TO authenticated USING (true);
CREATE POLICY "wholesaler_communications_insert" ON public.wholesaler_communications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wholesaler_communications_update" ON public.wholesaler_communications FOR UPDATE TO authenticated USING (true);

CREATE POLICY "wholesaler_territory_read" ON public.wholesaler_territory_coverage FOR SELECT TO authenticated USING (true);
CREATE POLICY "wholesaler_territory_insert" ON public.wholesaler_territory_coverage FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wholesaler_territory_update" ON public.wholesaler_territory_coverage FOR UPDATE TO authenticated USING (true);

CREATE POLICY "wholesaler_product_perf_read" ON public.wholesaler_product_performance FOR SELECT TO authenticated USING (true);
CREATE POLICY "wholesaler_product_perf_insert" ON public.wholesaler_product_performance FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "wholesaler_health_read" ON public.wholesaler_health_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "wholesaler_health_insert" ON public.wholesaler_health_snapshots FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "wholesaler_signals_read" ON public.wholesaler_ai_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "wholesaler_signals_insert" ON public.wholesaler_ai_signals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wholesaler_signals_update" ON public.wholesaler_ai_signals FOR UPDATE TO authenticated USING (true);

CREATE POLICY "wholesaler_contracts_read" ON public.wholesaler_contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "wholesaler_contracts_insert" ON public.wholesaler_contracts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wholesaler_contracts_update" ON public.wholesaler_contracts FOR UPDATE TO authenticated USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wholesaler_orders_wholesaler ON public.wholesaler_orders(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_wholesaler_orders_date ON public.wholesaler_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_wholesaler_payments_wholesaler ON public.wholesaler_payments(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_wholesaler_disputes_wholesaler ON public.wholesaler_disputes(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_wholesaler_disputes_status ON public.wholesaler_disputes(status);
CREATE INDEX IF NOT EXISTS idx_wholesaler_visits_wholesaler ON public.wholesaler_visits(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_wholesaler_visits_date ON public.wholesaler_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_wholesaler_communications_wholesaler ON public.wholesaler_communications(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_wholesaler_territory_wholesaler ON public.wholesaler_territory_coverage(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_wholesaler_territory_neighborhood ON public.wholesaler_territory_coverage(neighborhood);
CREATE INDEX IF NOT EXISTS idx_wholesaler_product_perf_wholesaler ON public.wholesaler_product_performance(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_wholesaler_health_wholesaler ON public.wholesaler_health_snapshots(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_wholesaler_signals_wholesaler ON public.wholesaler_ai_signals(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_wholesaler_signals_active ON public.wholesaler_ai_signals(is_active);
CREATE INDEX IF NOT EXISTS idx_wholesaler_contracts_wholesaler ON public.wholesaler_contracts(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_wholesaler_contracts_status ON public.wholesaler_contracts(status);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_wholesaler_intelligence_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_wholesaler_orders_timestamp
  BEFORE UPDATE ON public.wholesaler_orders
  FOR EACH ROW EXECUTE FUNCTION update_wholesaler_intelligence_timestamp();

CREATE TRIGGER update_wholesaler_territory_timestamp
  BEFORE UPDATE ON public.wholesaler_territory_coverage
  FOR EACH ROW EXECUTE FUNCTION update_wholesaler_intelligence_timestamp();

CREATE TRIGGER update_wholesaler_contracts_timestamp
  BEFORE UPDATE ON public.wholesaler_contracts
  FOR EACH ROW EXECUTE FUNCTION update_wholesaler_intelligence_timestamp();
