
-- ============================================================
-- WHOLESALER DUAL-ENGINE UPGRADE
-- ============================================================

-- 1. Add columns to wholesalers
ALTER TABLE public.wholesalers
  ADD COLUMN IF NOT EXISTS tier text DEFAULT 'silver',
  ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_score numeric DEFAULT 0;

-- 2. Supply Invoices
CREATE TABLE public.wholesaler_supply_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id uuid NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.wholesaler_orders(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  total_due numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'unpaid',
  issued_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Supply Returns
CREATE TABLE public.wholesaler_supply_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id uuid NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.wholesaler_orders(id) ON DELETE SET NULL,
  reason text NOT NULL,
  amount_adjusted numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Supply Order Items
CREATE TABLE public.wholesaler_supply_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.wholesaler_orders(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  brand text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_line numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at timestamptz DEFAULT now()
);

-- 5. Marketplace Inventory
CREATE TABLE public.marketplace_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.wholesale_products(id) ON DELETE CASCADE,
  wholesaler_id uuid NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  quantity_available integer NOT NULL DEFAULT 0,
  reserved_quantity integer NOT NULL DEFAULT 0,
  reorder_point integer DEFAULT 10,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, wholesaler_id)
);

-- 6. Marketplace Commissions
CREATE TABLE public.marketplace_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id uuid NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.wholesale_orders_platform(id) ON DELETE SET NULL,
  gross_amount numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 0.15,
  commission_amount numeric NOT NULL DEFAULT 0,
  wholesaler_net numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Summary Views
CREATE OR REPLACE VIEW public.wholesaler_supply_summary AS
SELECT
  w.id AS wholesaler_id, w.name, w.tier, w.credit_limit, w.payment_terms,
  COALESCE(SUM(wo.total_amount), 0) AS lifetime_purchase_total,
  COALESCE(SUM(wo.total_amount) FILTER (WHERE wo.payment_status IN ('unpaid','partial')), 0) AS unpaid_balance,
  COALESCE(AVG(wo.total_amount), 0) AS avg_order_value,
  COUNT(wo.id) AS total_orders,
  MAX(wo.order_date) AS last_order_date,
  w.relationship_health_score AS health_score,
  w.risk_level, w.ai_score
FROM public.wholesalers w
LEFT JOIN public.wholesaler_orders wo ON wo.wholesaler_id = w.id
GROUP BY w.id;

CREATE OR REPLACE VIEW public.wholesaler_marketplace_summary AS
SELECT
  w.id AS wholesaler_id, w.name,
  COUNT(DISTINCT wprod.id) AS total_products_uploaded,
  COUNT(DISTINCT wprod.id) FILTER (WHERE wprod.is_active) AS active_products,
  COALESCE(SUM(wop.total_amount), 0) AS total_revenue_generated,
  COUNT(DISTINCT wop.id) AS total_platform_orders,
  COALESCE(SUM(pay.platform_fee), 0) AS total_commission_earned,
  COALESCE(SUM(pay.net_amount), 0) AS total_payouts_sent,
  w.ai_score AS marketplace_ai_score
FROM public.wholesalers w
LEFT JOIN public.wholesale_products wprod ON wprod.wholesaler_id = w.id
LEFT JOIN public.wholesale_orders_platform wop ON wop.wholesaler_id = w.id
LEFT JOIN public.wholesaler_payouts pay ON pay.wholesaler_id = w.id
GROUP BY w.id;

-- RLS
ALTER TABLE public.wholesaler_supply_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesaler_supply_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesaler_supply_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Elevated manage supply invoices" ON public.wholesaler_supply_invoices FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Elevated manage supply returns" ON public.wholesaler_supply_returns FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Elevated manage supply order items" ON public.wholesaler_supply_order_items FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

CREATE POLICY "Elevated manage marketplace inventory" ON public.marketplace_inventory FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Elevated manage marketplace commissions" ON public.marketplace_commissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'))
WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'accountant'));

-- Indexes
CREATE INDEX idx_supply_invoices_wholesaler ON public.wholesaler_supply_invoices(wholesaler_id);
CREATE INDEX idx_supply_invoices_status ON public.wholesaler_supply_invoices(status);
CREATE INDEX idx_supply_returns_wholesaler ON public.wholesaler_supply_returns(wholesaler_id);
CREATE INDEX idx_supply_order_items_order ON public.wholesaler_supply_order_items(order_id);
CREATE INDEX idx_marketplace_inventory_wholesaler ON public.marketplace_inventory(wholesaler_id);
CREATE INDEX idx_marketplace_commissions_wholesaler ON public.marketplace_commissions(wholesaler_id);
