-- 🏛️ FOUNDATION LOCKDOWN PACK — UNIVERSAL DATA TABLES

-- UNIVERSAL ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.universal_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  customer_id UUID,
  amount NUMERIC(12,2) NOT NULL,
  channel TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- UNIVERSAL ACTIVITY LOG
CREATE TABLE IF NOT EXISTS public.universal_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- UNIVERSAL TRANSACTION LEDGER
CREATE TABLE IF NOT EXISTS public.universal_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  business_id UUID,
  amount NUMERIC(12,2),
  type TEXT NOT NULL, -- credit, debit, fee, payout
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- UNIVERSAL MESSAGE LOG (Text, Email, Calls)
CREATE TABLE IF NOT EXISTS public.universal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID,
  user_id UUID,
  message_type TEXT,
  status TEXT,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- UNIVERSAL AUDIT TRAIL
CREATE TABLE IF NOT EXISTS public.audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT,
  event TEXT,
  user_id UUID,
  before JSONB,
  after JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.universal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universal_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universal_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universal_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

-- RLS Policies for universal_orders
CREATE POLICY "Admins can manage all orders" ON public.universal_orders
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their business orders" ON public.universal_orders
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for universal_activity
CREATE POLICY "Admins can manage all activity" ON public.universal_activity
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view activity" ON public.universal_activity
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for universal_ledger
CREATE POLICY "Admins can manage ledger" ON public.universal_ledger
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Elevated users can view ledger" ON public.universal_ledger
  FOR SELECT USING (public.is_elevated_user(auth.uid()));

-- RLS Policies for universal_messages
CREATE POLICY "Admins can manage messages" ON public.universal_messages
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their messages" ON public.universal_messages
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- RLS Policies for audit_trail
CREATE POLICY "Admins can manage audit trail" ON public.audit_trail
  FOR ALL USING (public.is_admin(auth.uid()));

CREATE POLICY "Elevated users can view audit trail" ON public.audit_trail
  FOR SELECT USING (public.is_elevated_user(auth.uid()));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_universal_orders_business ON public.universal_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_universal_orders_status ON public.universal_orders(status);
CREATE INDEX IF NOT EXISTS idx_universal_orders_active ON public.universal_orders(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_universal_activity_business ON public.universal_activity(business_id);
CREATE INDEX IF NOT EXISTS idx_universal_activity_user ON public.universal_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_universal_ledger_order ON public.universal_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_universal_ledger_business ON public.universal_ledger(business_id);
CREATE INDEX IF NOT EXISTS idx_universal_messages_business ON public.universal_messages(business_id);
CREATE INDEX IF NOT EXISTS idx_universal_messages_user ON public.universal_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_module ON public.audit_trail(module);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user ON public.audit_trail(user_id);