
-- 1. Supplier price history for cost trend tracking
CREATE TABLE public.ut_supplier_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name TEXT NOT NULL,
  supplier_id UUID REFERENCES ut_suppliers(id) ON DELETE SET NULL,
  category_id UUID REFERENCES ut_domination_categories(id) ON DELETE SET NULL,
  product_name TEXT,
  unit_cost NUMERIC(10,2) NOT NULL,
  previous_cost NUMERIC(10,2),
  price_change_pct NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN previous_cost > 0 THEN ((unit_cost - previous_cost) / previous_cost) * 100 ELSE 0 END
  ) STORED,
  negotiated_discount_pct NUMERIC(5,2) DEFAULT 0,
  savings_amount NUMERIC(10,2) DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Automation rules engine
CREATE TABLE public.ut_gscs_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('performance_above','performance_below','volume_increase','category_growth','supplier_fail','reorder_trigger')),
  action_type TEXT NOT NULL CHECK (action_type IN ('upgrade_preferred','downgrade_supplier','renegotiate_pricing','expand_supplier_base','send_alert','auto_reorder')),
  threshold_value NUMERIC(10,2) DEFAULT 0,
  category_id UUID REFERENCES ut_domination_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Approval queue for supplier changes
CREATE TABLE public.ut_gscs_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_type TEXT NOT NULL CHECK (change_type IN ('upgrade_preferred','downgrade','new_supplier','remove_supplier','pricing_change','exclusivity_change','redundancy_change')),
  entity_type TEXT DEFAULT 'supplier',
  entity_id UUID,
  entity_name TEXT NOT NULL,
  change_summary TEXT NOT NULL,
  change_details JSONB DEFAULT '{}',
  requested_by TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','auto_approved')),
  reviewer_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Add partnership_start_date to category suppliers
ALTER TABLE public.ut_category_suppliers
  ADD COLUMN IF NOT EXISTS partnership_start_date DATE;

-- RLS
ALTER TABLE public.ut_supplier_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_gscs_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_gscs_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select" ON public.ut_supplier_price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.ut_supplier_price_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.ut_supplier_price_history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON public.ut_supplier_price_history FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select" ON public.ut_gscs_automation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.ut_gscs_automation_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.ut_gscs_automation_rules FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON public.ut_gscs_automation_rules FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth_select" ON public.ut_gscs_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.ut_gscs_approvals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.ut_gscs_approvals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON public.ut_gscs_approvals FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_ut_price_hist_supplier ON public.ut_supplier_price_history (supplier_name, recorded_at DESC);
CREATE INDEX idx_ut_gscs_rules_trigger ON public.ut_gscs_automation_rules (trigger_type, is_active);
CREATE INDEX idx_ut_gscs_approvals_status ON public.ut_gscs_approvals (status, created_at DESC);
