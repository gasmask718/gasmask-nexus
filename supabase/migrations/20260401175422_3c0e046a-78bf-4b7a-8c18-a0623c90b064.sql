
-- 1. Category Domination Master Table
CREATE TABLE public.ut_domination_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name TEXT NOT NULL UNIQUE,
  demand_score NUMERIC(4,1) DEFAULT 0 CHECK (demand_score >= 0 AND demand_score <= 100),
  margin_score NUMERIC(4,1) DEFAULT 0 CHECK (margin_score >= 0 AND margin_score <= 100),
  repeat_frequency NUMERIC(4,1) DEFAULT 0 CHECK (repeat_frequency >= 0 AND repeat_frequency <= 100),
  branding_potential NUMERIC(4,1) DEFAULT 0 CHECK (branding_potential >= 0 AND branding_potential <= 100),
  competition_score NUMERIC(4,1) DEFAULT 0 CHECK (competition_score >= 0 AND competition_score <= 100),
  total_score NUMERIC(5,2) GENERATED ALWAYS AS (
    demand_score * 0.3 + margin_score * 0.25 + repeat_frequency * 0.2 + branding_potential * 0.15 + competition_score * 0.1
  ) STORED,
  priority_level TEXT DEFAULT 'medium' CHECK (priority_level IN ('critical','high','medium','low')),
  status TEXT DEFAULT 'tracking' CHECK (status IN ('tracking','targeting','dominating','dominated')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Supplier Domination per Category
CREATE TABLE public.ut_category_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES ut_domination_categories(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES ut_suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  tier TEXT DEFAULT 'standard' CHECK (tier IN ('preferred','exclusive','standard','backup')),
  exclusivity_status TEXT DEFAULT 'none' CHECK (exclusivity_status IN ('none','negotiating','partial','full')),
  priority_status TEXT DEFAULT 'normal' CHECK (priority_status IN ('top','high','normal','low')),
  negotiated_terms JSONB DEFAULT '{}',
  volume_commitment_units INT DEFAULT 0,
  volume_commitment_period TEXT,
  avg_unit_cost NUMERIC(10,2),
  performance_score NUMERIC(4,1) DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Category-Level Pricing Engine
CREATE TABLE public.ut_category_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES ut_domination_categories(id) ON DELETE CASCADE,
  avg_supplier_cost NUMERIC(10,2) DEFAULT 0,
  avg_selling_price NUMERIC(10,2) DEFAULT 0,
  competitor_price_low NUMERIC(10,2),
  competitor_price_high NUMERIC(10,2),
  margin_pct NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN avg_selling_price > 0 THEN ((avg_selling_price - avg_supplier_cost) / avg_selling_price) * 100 ELSE 0 END
  ) STORED,
  pricing_strategy TEXT DEFAULT 'premium' CHECK (pricing_strategy IN ('undercut','match','premium','tiered')),
  tier_retail_price NUMERIC(10,2),
  tier_business_price NUMERIC(10,2),
  tier_bulk_price NUMERIC(10,2),
  tier_kit_price NUMERIC(10,2),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Branding Control per Category
CREATE TABLE public.ut_category_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES ut_domination_categories(id) ON DELETE CASCADE,
  total_products INT DEFAULT 0,
  branded_count INT DEFAULT 0,
  white_label_count INT DEFAULT 0,
  packaging_system TEXT,
  branding_adoption_pct NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_products > 0 THEN (branded_count::NUMERIC / total_products) * 100 ELSE 0 END
  ) STORED,
  kit_names TEXT[],
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Monthly Category Performance KPIs
CREATE TABLE public.ut_category_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES ut_domination_categories(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  revenue NUMERIC(12,2) DEFAULT 0,
  profit NUMERIC(12,2) DEFAULT 0,
  reorder_rate NUMERIC(5,2) DEFAULT 0,
  supplier_performance_avg NUMERIC(4,1) DEFAULT 0,
  customer_count INT DEFAULT 0,
  customer_growth_pct NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (category_id, period_month)
);

-- 6. AI Expansion Recommendations
CREATE TABLE public.ut_category_expansion_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES ut_domination_categories(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('new_product','new_supplier','new_bundle','pricing_strategy')),
  title TEXT NOT NULL,
  description TEXT,
  ai_confidence NUMERIC(4,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','implemented')),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE public.ut_domination_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_category_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_category_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_category_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_category_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_category_expansion_queue ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated full access
CREATE POLICY "auth_select" ON public.ut_domination_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.ut_domination_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.ut_domination_categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON public.ut_domination_categories FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select" ON public.ut_category_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.ut_category_suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.ut_category_suppliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON public.ut_category_suppliers FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select" ON public.ut_category_pricing FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.ut_category_pricing FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.ut_category_pricing FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON public.ut_category_pricing FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select" ON public.ut_category_branding FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.ut_category_branding FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.ut_category_branding FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON public.ut_category_branding FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select" ON public.ut_category_performance FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.ut_category_performance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.ut_category_performance FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON public.ut_category_performance FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select" ON public.ut_category_expansion_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.ut_category_expansion_queue FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.ut_category_expansion_queue FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON public.ut_category_expansion_queue FOR DELETE TO authenticated USING (true);

-- Indexes
CREATE INDEX idx_ut_dom_cats_score ON public.ut_domination_categories (total_score DESC);
CREATE INDEX idx_ut_cat_suppliers_cat ON public.ut_category_suppliers (category_id);
CREATE INDEX idx_ut_cat_perf_cat ON public.ut_category_performance (category_id, period_month);
CREATE INDEX idx_ut_cat_expansion_cat ON public.ut_category_expansion_queue (category_id, status);
