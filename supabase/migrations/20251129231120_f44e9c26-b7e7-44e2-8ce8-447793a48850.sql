
-- ======================================================================
-- MARKETPLACE MULTI-TENANT SCHEMA (FIXED)
-- ======================================================================

-- TABLE: products_all (Universal Product Catalog)
CREATE TABLE IF NOT EXISTS public.products_all (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id UUID REFERENCES public.wholesaler_profiles(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  description TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  unit_type TEXT DEFAULT 'unit',
  inventory_qty INTEGER DEFAULT 0,
  weight_oz NUMERIC DEFAULT 0,
  dimensions JSONB DEFAULT '{"length": 0, "width": 0, "height": 0}'::jsonb,
  retail_price NUMERIC DEFAULT 0,
  store_price NUMERIC DEFAULT 0,
  wholesale_price NUMERIC DEFAULT 0,
  shipping_from_city TEXT,
  shipping_from_state TEXT,
  processing_time TEXT DEFAULT '1-3 days',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TABLE: pricing_tiers
CREATE TABLE IF NOT EXISTS public.pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products_all(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('retail', 'store', 'wholesale')),
  min_qty INTEGER DEFAULT 1,
  price_per_unit NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TABLE: carts
CREATE TABLE IF NOT EXISTS public.carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'abandoned', 'converted')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TABLE: cart_items
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products_all(id) ON DELETE CASCADE,
  qty INTEGER DEFAULT 1,
  price_locked NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TABLE: marketplace_orders
CREATE TABLE IF NOT EXISTS public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  wholesaler_id UUID REFERENCES public.wholesaler_profiles(id),
  shipping_address JSONB,
  billing_address JSONB,
  order_type TEXT DEFAULT 'customer' CHECK (order_type IN ('customer', 'store')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
  fulfillment_status TEXT DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'processing', 'label_created', 'shipped', 'delivered', 'cancelled')),
  subtotal NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  shipping_funded_by_customer BOOLEAN DEFAULT true,
  stripe_payment_intent_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TABLE: marketplace_order_items
CREATE TABLE IF NOT EXISTS public.marketplace_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products_all(id),
  wholesaler_id UUID REFERENCES public.wholesaler_profiles(id),
  qty INTEGER DEFAULT 1,
  price_each NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TABLE: shipping_labels
CREATE TABLE IF NOT EXISTS public.shipping_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  carrier TEXT,
  service_type TEXT,
  label_url TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  label_cost NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'created', 'printed', 'voided')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TABLE: order_routing
CREATE TABLE IF NOT EXISTS public.order_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  assigned_wholesaler_id UUID REFERENCES public.wholesaler_profiles(id),
  assigned_driver_id UUID REFERENCES public.driver_profiles(id),
  assigned_biker_id UUID REFERENCES public.biker_profiles(id),
  pickup_required BOOLEAN DEFAULT false,
  cash_collection BOOLEAN DEFAULT false,
  cash_amount NUMERIC DEFAULT 0,
  delivery_type TEXT DEFAULT 'ship' CHECK (delivery_type IN ('ship', 'pickup', 'delivery')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'accepted', 'enroute', 'completed', 'failed')),
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TABLE: production_logs
CREATE TABLE IF NOT EXISTS public.production_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id),
  production_date DATE DEFAULT CURRENT_DATE,
  tubes_produced INTEGER DEFAULT 0,
  boxes_packed INTEGER DEFAULT 0,
  materials_used JSONB DEFAULT '{}'::jsonb,
  labor_hours NUMERIC DEFAULT 0,
  defects_count INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TABLE: affiliate_clicks
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID REFERENCES public.ambassadors(id),
  referral_code TEXT,
  ip_address TEXT,
  user_agent TEXT,
  landing_page TEXT,
  converted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TABLE: affiliate_conversions
CREATE TABLE IF NOT EXISTS public.affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID REFERENCES public.ambassadors(id),
  order_id UUID REFERENCES public.marketplace_orders(id),
  click_id UUID REFERENCES public.affiliate_clicks(id),
  commission_rate NUMERIC DEFAULT 0.10,
  commission_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TABLE: accounting_ledger
CREATE TABLE IF NOT EXISTS public.accounting_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('order', 'expense', 'payout', 'salary', 'transfer', 'refund', 'fee')),
  source_id UUID,
  brand TEXT,
  amount NUMERIC NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  category TEXT,
  notes TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TABLE: personal_finance
CREATE TABLE IF NOT EXISTS public.personal_finance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'investment')),
  amount NUMERIC NOT NULL,
  category TEXT,
  subcategory TEXT,
  notes TEXT,
  transaction_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TABLE: multi_language_content
CREATE TABLE IF NOT EXISTS public.multi_language_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  key TEXT NOT NULL,
  content_en TEXT,
  content_es TEXT,
  content_fr TEXT,
  content_ar TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(module, key)
);

-- TABLE: wholesaler_payouts
CREATE TABLE IF NOT EXISTS public.wholesaler_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id UUID REFERENCES public.wholesaler_profiles(id),
  amount NUMERIC NOT NULL,
  platform_fee NUMERIC DEFAULT 0,
  net_amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  payout_method TEXT,
  payout_reference TEXT,
  period_start DATE,
  period_end DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ======================================================================
-- ENABLE ROW LEVEL SECURITY
-- ======================================================================

ALTER TABLE public.products_all ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_routing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_finance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multi_language_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesaler_payouts ENABLE ROW LEVEL SECURITY;

-- ======================================================================
-- RLS POLICIES
-- ======================================================================

-- Products: Public read, wholesaler write own
CREATE POLICY "Anyone can view active products" ON public.products_all FOR SELECT USING (status = 'active');
CREATE POLICY "Wholesalers manage own products" ON public.products_all FOR ALL USING (
  EXISTS (SELECT 1 FROM public.wholesaler_profiles wp WHERE wp.id = products_all.wholesaler_id AND wp.user_id = auth.uid())
);
CREATE POLICY "Admins manage all products" ON public.products_all FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Pricing tiers
CREATE POLICY "Anyone can view pricing" ON public.pricing_tiers FOR SELECT USING (true);
CREATE POLICY "Admins manage pricing" ON public.pricing_tiers FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Carts
CREATE POLICY "Users manage own cart" ON public.carts FOR ALL USING (user_id = auth.uid());

-- Cart items
CREATE POLICY "Users manage own cart items" ON public.cart_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.carts c WHERE c.id = cart_items.cart_id AND c.user_id = auth.uid())
);

-- Orders
CREATE POLICY "Users view own orders" ON public.marketplace_orders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users create own orders" ON public.marketplace_orders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Wholesalers view assigned orders" ON public.marketplace_orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.wholesaler_profiles wp WHERE wp.id = marketplace_orders.wholesaler_id AND wp.user_id = auth.uid())
);
CREATE POLICY "Admins manage all orders" ON public.marketplace_orders FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Order items
CREATE POLICY "Users view own order items" ON public.marketplace_order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.marketplace_orders o WHERE o.id = marketplace_order_items.order_id AND o.user_id = auth.uid())
);
CREATE POLICY "System insert order items" ON public.marketplace_order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins manage order items" ON public.marketplace_order_items FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Shipping labels
CREATE POLICY "Users view own labels" ON public.shipping_labels FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.marketplace_orders o WHERE o.id = shipping_labels.order_id AND o.user_id = auth.uid())
);
CREATE POLICY "Wholesalers view assigned labels" ON public.shipping_labels FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.marketplace_orders o JOIN public.wholesaler_profiles wp ON o.wholesaler_id = wp.id WHERE o.id = shipping_labels.order_id AND wp.user_id = auth.uid())
);
CREATE POLICY "System manage labels" ON public.shipping_labels FOR ALL USING (true);

-- Order routing
CREATE POLICY "Admins manage routing" ON public.order_routing FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Drivers view assigned" ON public.order_routing FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.driver_profiles dp WHERE dp.id = order_routing.assigned_driver_id AND dp.user_id = auth.uid())
);
CREATE POLICY "System insert routing" ON public.order_routing FOR INSERT WITH CHECK (true);

-- Production logs
CREATE POLICY "Authenticated view production" ON public.production_logs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage production" ON public.production_logs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System insert production" ON public.production_logs FOR INSERT WITH CHECK (true);

-- Affiliate clicks
CREATE POLICY "System insert clicks" ON public.affiliate_clicks FOR INSERT WITH CHECK (true);
CREATE POLICY "Ambassadors view own clicks" ON public.affiliate_clicks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ambassadors a WHERE a.id = affiliate_clicks.ambassador_id AND a.user_id = auth.uid())
);

-- Affiliate conversions
CREATE POLICY "Ambassadors view own conversions" ON public.affiliate_conversions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ambassadors a WHERE a.id = affiliate_conversions.ambassador_id AND a.user_id = auth.uid())
);
CREATE POLICY "Admins manage conversions" ON public.affiliate_conversions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Accounting ledger
CREATE POLICY "Admins manage ledger" ON public.accounting_ledger FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Personal finance
CREATE POLICY "Users manage own finance" ON public.personal_finance FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admins view all finance" ON public.personal_finance FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Multi language content
CREATE POLICY "Anyone view translations" ON public.multi_language_content FOR SELECT USING (true);
CREATE POLICY "Admins manage translations" ON public.multi_language_content FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Wholesaler payouts
CREATE POLICY "Wholesalers view own payouts" ON public.wholesaler_payouts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.wholesaler_profiles wp WHERE wp.id = wholesaler_payouts.wholesaler_id AND wp.user_id = auth.uid())
);
CREATE POLICY "Admins manage payouts" ON public.wholesaler_payouts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ======================================================================
-- INDEXES
-- ======================================================================

CREATE INDEX IF NOT EXISTS idx_products_all_wholesaler ON public.products_all(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_products_all_brand ON public.products_all(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_all_status ON public.products_all(status);
CREATE INDEX IF NOT EXISTS idx_carts_user ON public.carts(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_user ON public.marketplace_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_wholesaler ON public.marketplace_orders(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON public.marketplace_orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_order_routing_order ON public.order_routing(order_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_ambassador ON public.affiliate_clicks(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_personal_finance_user ON public.personal_finance(user_id);

-- ======================================================================
-- REALTIME
-- ======================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_routing;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shipping_labels;
