
-- ====================================
-- DYNASTY OS — INDUSTRY & BUSINESS NORMALIZATION SCHEMA
-- Foundation layer for multi-business, multi-industry accounting intelligence
-- ====================================

-- 1️⃣ INDUSTRY CATALOG (Normalization layer)
CREATE TABLE public.industry_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  industry_name TEXT NOT NULL UNIQUE,
  industry_group TEXT NOT NULL CHECK (industry_group IN ('services', 'retail', 'digital', 'logistics', 'entertainment', 'manufacturing', 'other')),
  margin_expectation_low NUMERIC(5,2) DEFAULT 0,
  margin_expectation_high NUMERIC(5,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.industry_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Industry catalog readable by authenticated users"
  ON public.industry_catalog FOR SELECT
  USING (true);

CREATE POLICY "Industry catalog manageable by authenticated users"
  ON public.industry_catalog FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed canonical industries
INSERT INTO public.industry_catalog (industry_name, industry_group, margin_expectation_low, margin_expectation_high, notes) VALUES
  ('Transportation', 'logistics', 8, 20, 'Fleet, dispatch, logistics services'),
  ('Retail', 'retail', 15, 40, 'Product sales, storefronts'),
  ('Adult Entertainment', 'entertainment', 30, 60, 'Content, events, venues'),
  ('Cleaning Services', 'services', 20, 45, 'Commercial and residential cleaning'),
  ('Events & Hospitality', 'entertainment', 10, 35, 'Event planning, catering, venues'),
  ('Wholesale Distribution', 'logistics', 5, 15, 'Bulk product distribution'),
  ('Digital & Technology', 'digital', 40, 80, 'SaaS, platforms, digital products'),
  ('Manufacturing', 'manufacturing', 10, 30, 'Product manufacturing, assembly'),
  ('Food & Beverage', 'retail', 5, 20, 'Restaurants, food production'),
  ('Professional Services', 'services', 25, 55, 'Consulting, legal, accounting'),
  ('Real Estate', 'services', 15, 40, 'Property management, investments'),
  ('Marketing & Media', 'digital', 20, 50, 'Advertising, content, branding'),
  ('Health & Wellness', 'services', 15, 40, 'Fitness, healthcare, beauty'),
  ('Tobacco & Smoke Shop', 'retail', 30, 55, 'Smoke products, accessories'),
  ('Other', 'other', 0, 100, 'Uncategorized or emerging industries');

-- 2️⃣ ENHANCE BUSINESSES TABLE (Business Registry fields)
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'internal_os'
    CHECK (business_type IN ('internal_os', 'external_platform', 'offline')),
  ADD COLUMN IF NOT EXISTS operational_status TEXT NOT NULL DEFAULT 'active'
    CHECK (operational_status IN ('active', 'paused', 'prelaunch', 'archived')),
  ADD COLUMN IF NOT EXISTS ownership_type TEXT NOT NULL DEFAULT 'wholly_owned'
    CHECK (ownership_type IN ('wholly_owned', 'partnership', 'minority_interest')),
  ADD COLUMN IF NOT EXISTS parent_entity_id UUID REFERENCES public.businesses(id),
  ADD COLUMN IF NOT EXISTS industry_catalog_id UUID REFERENCES public.industry_catalog(id);

-- 3️⃣ EXPENSE CATEGORY CATALOG (Normalized)
CREATE TABLE public.expense_category_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_name TEXT NOT NULL UNIQUE,
  category_group TEXT NOT NULL CHECK (category_group IN ('operating', 'cogs', 'overhead', 'discretionary')),
  tax_deductible BOOLEAN NOT NULL DEFAULT true,
  applies_to_industries UUID[] DEFAULT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_category_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expense categories readable by all"
  ON public.expense_category_catalog FOR SELECT USING (true);

CREATE POLICY "Expense categories manageable by authenticated"
  ON public.expense_category_catalog FOR ALL USING (true) WITH CHECK (true);

-- Seed canonical expense categories
INSERT INTO public.expense_category_catalog (category_name, category_group, tax_deductible, sort_order) VALUES
  ('Labor & Payroll', 'operating', true, 1),
  ('Cost of Goods Sold', 'cogs', true, 2),
  ('Tubes & Raw Materials', 'cogs', true, 3),
  ('Packaging & Supplies', 'cogs', true, 4),
  ('Equipment & Tools', 'operating', true, 5),
  ('Office & Rent', 'overhead', true, 6),
  ('Utilities', 'overhead', true, 7),
  ('Insurance', 'overhead', true, 8),
  ('Marketing & Advertising', 'discretionary', true, 9),
  ('Logistics & Shipping', 'operating', true, 10),
  ('Vehicle & Fleet', 'operating', true, 11),
  ('Professional Services', 'overhead', true, 12),
  ('Technology & Software', 'overhead', true, 13),
  ('Licenses & Permits', 'overhead', true, 14),
  ('Travel & Entertainment', 'discretionary', true, 15),
  ('Repairs & Maintenance', 'operating', true, 16),
  ('Cleaning Supplies', 'cogs', true, 17),
  ('Contractor Payments', 'operating', true, 18),
  ('Bank & Processing Fees', 'overhead', true, 19),
  ('Taxes & Government', 'overhead', false, 20),
  ('Other', 'discretionary', false, 99);

-- 4️⃣ REVENUE CATEGORY CATALOG (Normalized)
CREATE TABLE public.revenue_category_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_name TEXT NOT NULL UNIQUE,
  revenue_group TEXT NOT NULL CHECK (revenue_group IN ('recurring', 'transactional', 'one_time')),
  notes TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue_category_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Revenue categories readable by all"
  ON public.revenue_category_catalog FOR SELECT USING (true);

CREATE POLICY "Revenue categories manageable by authenticated"
  ON public.revenue_category_catalog FOR ALL USING (true) WITH CHECK (true);

-- Seed canonical revenue categories
INSERT INTO public.revenue_category_catalog (category_name, revenue_group, sort_order, notes) VALUES
  ('Product Sales', 'transactional', 1, 'Direct product revenue'),
  ('Service Revenue', 'transactional', 2, 'Service-based income'),
  ('Subscription Revenue', 'recurring', 3, 'Recurring subscriptions'),
  ('Wholesale Revenue', 'transactional', 4, 'Bulk/wholesale orders'),
  ('Commission Income', 'transactional', 5, 'Earned commissions'),
  ('Marketplace Fees', 'transactional', 6, 'Platform/marketplace cuts'),
  ('Rental Income', 'recurring', 7, 'Property or equipment rental'),
  ('Event Revenue', 'one_time', 8, 'Event-based income'),
  ('Consulting & Advisory', 'transactional', 9, 'Professional advisory fees'),
  ('Licensing & Royalties', 'recurring', 10, 'IP licensing income'),
  ('Investment Returns', 'one_time', 11, 'Returns on investments'),
  ('Other Income', 'one_time', 99, 'Uncategorized revenue');

-- 5️⃣ BUSINESS FINANCIAL SNAPSHOTS (Aggregation layer)
CREATE TABLE public.business_financial_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  total_revenue NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_expenses NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_profit NUMERIC(14,2) GENERATED ALWAYS AS (total_revenue - total_expenses) STORED,
  data_source TEXT NOT NULL DEFAULT 'manual' CHECK (data_source IN ('live', 'manual', 'estimated')),
  confidence_score INT NOT NULL DEFAULT 50 CHECK (confidence_score BETWEEN 0 AND 100),
  revenue_breakdown JSONB DEFAULT '{}',
  expense_breakdown JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, snapshot_date, period_type)
);

ALTER TABLE public.business_financial_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financial snapshots readable by authenticated"
  ON public.business_financial_snapshots FOR SELECT USING (true);

CREATE POLICY "Financial snapshots manageable by authenticated"
  ON public.business_financial_snapshots FOR ALL USING (true) WITH CHECK (true);

-- Index for fast rollup queries
CREATE INDEX idx_snapshots_business_date ON public.business_financial_snapshots (business_id, snapshot_date DESC);
CREATE INDEX idx_snapshots_period ON public.business_financial_snapshots (period_type, snapshot_date DESC);

-- 6️⃣ ENHANCE business_financial_profiles with FK to industry_catalog
ALTER TABLE public.business_financial_profiles
  ADD COLUMN IF NOT EXISTS industry_catalog_id UUID REFERENCES public.industry_catalog(id),
  ADD COLUMN IF NOT EXISTS confidence_score INT DEFAULT 50 CHECK (confidence_score BETWEEN 0 AND 100);

-- 7️⃣ TIMESTAMP TRIGGERS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_industry_catalog_updated_at
  BEFORE UPDATE ON public.industry_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_snapshots_updated_at
  BEFORE UPDATE ON public.business_financial_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
