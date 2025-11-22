-- Phase 3 Part 4: Wallets, Subscriptions, Bidding, Compliance, Credits, and Capacity Tracking

-- 1. Wallets System
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0,
  pending_balance NUMERIC NOT NULL DEFAULT 0,
  total_earned NUMERIC NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC NOT NULL DEFAULT 0,
  payout_method TEXT,
  payout_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Store Subscriptions
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tier TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  benefits JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  payment_method TEXT DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Wholesale Bidding System
CREATE TABLE IF NOT EXISTS wholesale_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES wholesale_orders(id) ON DELETE CASCADE,
  wholesaler_id UUID NOT NULL REFERENCES wholesale_hubs(id),
  price NUMERIC NOT NULL,
  estimated_delivery_hours INTEGER NOT NULL,
  delivery_method TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Supplier Compliance Engine
CREATE TABLE IF NOT EXISTS supplier_compliance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id UUID NOT NULL REFERENCES wholesale_hubs(id) ON DELETE CASCADE,
  on_time_delivery_rate NUMERIC DEFAULT 100,
  order_accuracy_rate NUMERIC DEFAULT 100,
  defect_count INTEGER DEFAULT 0,
  complaint_count INTEGER DEFAULT 0,
  refund_count INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  rating TEXT NOT NULL DEFAULT 'Excellent',
  last_calculated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(wholesaler_id)
);

-- 5. Store Credits System
CREATE TABLE IF NOT EXISTS store_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0,
  total_earned NUMERIC NOT NULL DEFAULT 0,
  total_spent NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);

CREATE TABLE IF NOT EXISTS store_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_account_id UUID NOT NULL REFERENCES store_credits(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Delivery Capacity Metrics
CREATE TABLE IF NOT EXISTS delivery_capacity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  driver_count INTEGER NOT NULL DEFAULT 0,
  biker_count INTEGER NOT NULL DEFAULT 0,
  daily_capacity INTEGER NOT NULL DEFAULT 0,
  current_load INTEGER NOT NULL DEFAULT 0,
  utilization_rate NUMERIC,
  hiring_recommendation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(city, state)
);

-- 7. Automation Communication Settings
CREATE TABLE IF NOT EXISTS automation_communication_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_type TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  trigger_days INTEGER,
  message_template TEXT NOT NULL,
  frequency_limit TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(automation_type)
);

-- Enable RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wholesale_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_compliance_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_capacity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_communication_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Wallets
CREATE POLICY "Users can view own wallet"
  ON wallets FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "System can manage wallets"
  ON wallets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Users can view own transactions"
  ON wallet_transactions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "System can create transactions"
  ON wallet_transactions FOR INSERT
  WITH CHECK (true);

-- RLS Policies for Subscriptions
CREATE POLICY "Anyone can view active plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Admins can manage plans"
  ON subscription_plans FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Anyone can view store subscriptions"
  ON store_subscriptions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage subscriptions"
  ON store_subscriptions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- RLS Policies for Bidding
CREATE POLICY "Wholesalers can create bids"
  ON wholesale_bids FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view bids"
  ON wholesale_bids FOR SELECT
  USING (true);

CREATE POLICY "Admins and wholesalers can update bids"
  ON wholesale_bids FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'csr')
  ));

-- RLS Policies for Compliance
CREATE POLICY "Anyone can view compliance scores"
  ON supplier_compliance_scores FOR SELECT
  USING (true);

CREATE POLICY "System can manage compliance"
  ON supplier_compliance_scores FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- RLS Policies for Credits
CREATE POLICY "Anyone can view store credits"
  ON store_credits FOR SELECT
  USING (true);

CREATE POLICY "System can manage credits"
  ON store_credits FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Anyone can view credit transactions"
  ON store_credit_transactions FOR SELECT
  USING (true);

CREATE POLICY "System can create credit transactions"
  ON store_credit_transactions FOR INSERT
  WITH CHECK (true);

-- RLS Policies for Capacity Metrics
CREATE POLICY "Admins can view capacity"
  ON delivery_capacity_metrics FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Admins can manage capacity"
  ON delivery_capacity_metrics FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- RLS Policies for Automation Settings
CREATE POLICY "Admins can manage automation"
  ON automation_communication_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Triggers for updated_at
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_subscriptions_updated_at
  BEFORE UPDATE ON store_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_compliance_updated_at
  BEFORE UPDATE ON supplier_compliance_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_credits_updated_at
  BEFORE UPDATE ON store_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_capacity_metrics_updated_at
  BEFORE UPDATE ON delivery_capacity_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_settings_updated_at
  BEFORE UPDATE ON automation_communication_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default subscription plans
INSERT INTO subscription_plans (name, tier, price, benefits) VALUES
  ('Free', 'free', 0, '{"features": ["Standard access", "Basic support", "Standard delivery"]}'),
  ('Pro', 'pro', 99, '{"features": ["Reduced wholesale fees", "Priority support", "2-day delivery", "Monthly analytics"]}'),
  ('Elite', 'elite', 299, '{"features": ["Priority delivery", "Free weekly restock", "Dedicated account manager", "Advanced analytics", "5% wholesale discount"]}'),
  ('Diamond', 'diamond', 599, '{"features": ["Custom box packaging", "Dedicated driver", "Same-day delivery", "10% wholesale discount", "Premium support", "Quarterly business review"]}');

-- Insert default automation settings
INSERT INTO automation_communication_settings (automation_type, is_enabled, trigger_days, message_template, frequency_limit) VALUES
  ('no_communication', false, 7, 'Hi {store_name}! We noticed it''s been a week since we last connected. Is there anything we can help you with?', 'once_per_week'),
  ('low_inventory', false, null, 'Hi {store_name}! Our system shows your inventory might be running low. Would you like us to send over a restock suggestion?', 'once_per_day'),
  ('missed_delivery', false, null, 'We sincerely apologize for missing your delivery. We''re working to reschedule as soon as possible. Thank you for your patience!', 'immediate'),
  ('large_purchase_thanks', false, null, 'Thank you for your order, {store_name}! We appreciate your business and look forward to serving you again.', 'immediate');