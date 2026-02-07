
-- ═══════════════════════════════════════════════════════════════════════
-- AMBASSADOR PURCHASE LEDGER: Data Model + Views + RLS
-- ═══════════════════════════════════════════════════════════════════════

-- 1) Create ambassador_purchases table
CREATE TABLE public.ambassador_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL DEFAULT ('AP-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0')),
  ambassador_user_id UUID NOT NULL,
  ambassador_id UUID REFERENCES public.ambassadors(id),
  status TEXT NOT NULL DEFAULT 'draft',
  order_source TEXT NOT NULL DEFAULT 'admin_backoffice',
  created_by_user_id UUID NOT NULL,
  created_for_user_id UUID NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  discount_total NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Create ambassador_purchase_items table
CREATE TABLE public.ambassador_purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES public.ambassador_purchases(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_name_snapshot TEXT NOT NULL,
  unit_price_snapshot NUMERIC NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  line_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Indexes
CREATE UNIQUE INDEX idx_ambassador_purchases_order_number ON public.ambassador_purchases(order_number);
CREATE INDEX idx_ambassador_purchases_user ON public.ambassador_purchases(ambassador_user_id);
CREATE INDEX idx_ambassador_purchases_status ON public.ambassador_purchases(status);
CREATE INDEX idx_ambassador_purchases_created ON public.ambassador_purchases(created_at DESC);
CREATE INDEX idx_ambassador_purchase_items_purchase ON public.ambassador_purchase_items(purchase_id);

-- 4) Enable RLS
ALTER TABLE public.ambassador_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_purchase_items ENABLE ROW LEVEL SECURITY;

-- 5) RLS: Ambassadors see own purchases
CREATE POLICY "Ambassadors can view own purchases"
  ON public.ambassador_purchases FOR SELECT
  USING (ambassador_user_id = auth.uid());

-- Admin/Owner/VA see all purchases (using profiles.role)
CREATE POLICY "Admin can view all purchases"
  ON public.ambassador_purchases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role::text IN ('admin', 'owner', 'ceo', 'va', 'accountant')
    )
  );

-- Admin/Owner/VA can create purchases
CREATE POLICY "Admin can create purchases"
  ON public.ambassador_purchases FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role::text IN ('admin', 'owner', 'ceo', 'va')
    )
  );

-- Admin/Owner/VA can update purchases
CREATE POLICY "Admin can update purchases"
  ON public.ambassador_purchases FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role::text IN ('admin', 'owner', 'ceo', 'va')
    )
  );

-- 6) RLS for purchase items
CREATE POLICY "View items if can view purchase"
  ON public.ambassador_purchase_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ambassador_purchases ap
      WHERE ap.id = purchase_id
      AND (
        ap.ambassador_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role::text IN ('admin', 'owner', 'ceo', 'va', 'accountant')
        )
      )
    )
  );

CREATE POLICY "Admin can create purchase items"
  ON public.ambassador_purchase_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role::text IN ('admin', 'owner', 'ceo', 'va')
    )
  );

-- 7) Updated_at trigger
CREATE TRIGGER update_ambassador_purchases_updated_at
  BEFORE UPDATE ON public.ambassador_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8) View: v_ambassador_purchase_history
CREATE OR REPLACE VIEW public.v_ambassador_purchase_history AS
SELECT 
  ap.id AS order_id,
  ap.order_number,
  ap.ambassador_user_id,
  ap.ambassador_id,
  COALESCE(amb.name, p.name, 'Ambassador') AS ambassador_name,
  ap.status,
  ap.order_source,
  ap.currency,
  ap.subtotal,
  ap.tax,
  ap.discount_total,
  ap.total,
  ap.paid_at,
  ap.fulfilled_at,
  ap.notes,
  ap.created_by_user_id,
  ap.created_at,
  ap.updated_at,
  (SELECT COUNT(*) FROM public.ambassador_purchase_items WHERE purchase_id = ap.id) AS items_count,
  SUM(ap.total) OVER (PARTITION BY ap.ambassador_user_id) AS lifetime_spend,
  COUNT(*) OVER (PARTITION BY ap.ambassador_user_id) AS purchase_count,
  MAX(ap.created_at) OVER (PARTITION BY ap.ambassador_user_id) AS last_purchase_at
FROM public.ambassador_purchases ap
LEFT JOIN public.ambassadors amb ON amb.id = ap.ambassador_id
LEFT JOIN public.profiles p ON p.id = ap.ambassador_user_id;

-- 9) View: v_ambassador_purchase_summary
CREATE OR REPLACE VIEW public.v_ambassador_purchase_summary AS
SELECT 
  ap.ambassador_user_id,
  ap.ambassador_id,
  COALESCE(amb.name, p.name, 'Ambassador') AS ambassador_name,
  COUNT(*) AS purchase_count,
  COALESCE(SUM(ap.total), 0) AS lifetime_spend,
  MAX(ap.created_at) AS last_purchase_at,
  CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(ap.total), 0) / COUNT(*) ELSE 0 END AS avg_order_value,
  EXTRACT(DAY FROM now() - MAX(ap.created_at))::INTEGER AS days_since_last_purchase
FROM public.ambassador_purchases ap
LEFT JOIN public.ambassadors amb ON amb.id = ap.ambassador_id
LEFT JOIN public.profiles p ON p.id = ap.ambassador_user_id
WHERE ap.status NOT IN ('cancelled', 'refunded')
GROUP BY ap.ambassador_user_id, ap.ambassador_id, amb.name, p.name;
