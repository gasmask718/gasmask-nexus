
-- 1. Extend ut_category_suppliers with lock-in & redundancy fields
ALTER TABLE public.ut_category_suppliers
  ADD COLUMN IF NOT EXISTS preferred_partner BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_production BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS negotiated_discount_tiers JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS lead_time_priority TEXT DEFAULT 'standard' CHECK (lead_time_priority IN ('express','priority','standard','economy')),
  ADD COLUMN IF NOT EXISTS redundancy_role TEXT DEFAULT 'standard' CHECK (redundancy_role IN ('primary','backup','emergency','standard'));

-- 2. Volume tracking per supplier
CREATE TABLE public.ut_supplier_volume_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES ut_suppliers(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  category_id UUID REFERENCES ut_domination_categories(id) ON DELETE SET NULL,
  period_month DATE NOT NULL,
  order_count INT DEFAULT 0,
  total_units INT DEFAULT 0,
  total_spend NUMERIC(12,2) DEFAULT 0,
  avg_unit_cost NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (supplier_id, category_id, period_month)
);

-- 3. Reorder rules engine
CREATE TABLE public.ut_reorder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES ut_domination_categories(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('time_based','usage_based','growth_based')),
  trigger_days INT,
  trigger_threshold INT,
  reorder_qty INT DEFAULT 1,
  auto_notify BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Supplier feedback / performance reviews
CREATE TABLE public.ut_supplier_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES ut_suppliers(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  category_id UUID REFERENCES ut_domination_categories(id) ON DELETE SET NULL,
  order_ref TEXT,
  quality_score NUMERIC(3,1) DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 10),
  speed_score NUMERIC(3,1) DEFAULT 0 CHECK (speed_score >= 0 AND speed_score <= 10),
  branding_score NUMERIC(3,1) DEFAULT 0 CHECK (branding_score >= 0 AND branding_score <= 10),
  communication_score NUMERIC(3,1) DEFAULT 0 CHECK (communication_score >= 0 AND communication_score <= 10),
  overall_score NUMERIC(3,1) GENERATED ALWAYS AS (
    (quality_score + speed_score + branding_score + communication_score) / 4.0
  ) STORED,
  notes TEXT,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.ut_supplier_volume_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_reorder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_supplier_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select" ON public.ut_supplier_volume_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.ut_supplier_volume_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.ut_supplier_volume_history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON public.ut_supplier_volume_history FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select" ON public.ut_reorder_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.ut_reorder_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.ut_reorder_rules FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON public.ut_reorder_rules FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select" ON public.ut_supplier_feedback FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.ut_supplier_feedback FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.ut_supplier_feedback FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON public.ut_supplier_feedback FOR DELETE TO authenticated USING (true);

-- Indexes
CREATE INDEX idx_ut_vol_hist_supplier ON public.ut_supplier_volume_history (supplier_id, period_month);
CREATE INDEX idx_ut_reorder_cat ON public.ut_reorder_rules (category_id);
CREATE INDEX idx_ut_feedback_supplier ON public.ut_supplier_feedback (supplier_id);
