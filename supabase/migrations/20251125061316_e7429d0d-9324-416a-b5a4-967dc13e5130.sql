-- Step 1: Create enums if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'brand_type') THEN
    CREATE TYPE brand_type AS ENUM ('GasMask', 'HotMama', 'GrabbaRUs', 'HotScalati');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_terms_type') THEN
    CREATE TYPE credit_terms_type AS ENUM ('COD', 'NET7', 'NET14', 'NET30');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loyalty_level_type') THEN
    CREATE TYPE loyalty_level_type AS ENUM ('Bronze', 'Silver', 'Gold', 'VIP');
  END IF;
END $$;

-- Step 2: Create store_master table
CREATE TABLE IF NOT EXISTS store_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  owner_name TEXT,
  store_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 3: Create store_brand_accounts table
CREATE TABLE IF NOT EXISTS store_brand_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_master_id UUID NOT NULL REFERENCES store_master(id) ON DELETE CASCADE,
  brand brand_type NOT NULL,
  active_status BOOLEAN DEFAULT true,
  credit_terms credit_terms_type DEFAULT 'COD',
  loyalty_level loyalty_level_type DEFAULT 'Bronze',
  total_spent DECIMAL(10,2) DEFAULT 0,
  last_order_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_master_id, brand)
);

-- Step 4: Create remaining tables
CREATE TABLE IF NOT EXISTS biker_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  biker_name TEXT NOT NULL,
  biker_phone TEXT,
  route_date DATE NOT NULL,
  store_master_id UUID REFERENCES store_master(id) ON DELETE CASCADE,
  delivery_summary TEXT,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brand_crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_brand_account_id UUID NOT NULL REFERENCES store_brand_accounts(id) ON DELETE CASCADE,
  brand brand_type NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  tags TEXT[],
  last_contacted TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batch_upload_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  va_id UUID,
  file_name TEXT NOT NULL,
  rows_processed INTEGER DEFAULT 0,
  brands_detected TEXT[],
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brand_inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand brand_type NOT NULL,
  product_type TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  movement_type TEXT NOT NULL,
  store_brand_account_id UUID REFERENCES store_brand_accounts(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_master_id UUID REFERENCES store_master(id) ON DELETE CASCADE,
  brand brand_type,
  insight_type TEXT NOT NULL,
  insight_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Step 5: Enable RLS on all new tables
ALTER TABLE store_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_brand_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE biker_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_upload_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_ai_insights ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies (drop first to avoid duplicates)
DROP POLICY IF EXISTS "Admins manage store_master" ON store_master;
CREATE POLICY "Admins manage store_master" ON store_master 
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage store_brand_accounts" ON store_brand_accounts;
CREATE POLICY "Admins manage store_brand_accounts" ON store_brand_accounts 
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage biker_routes" ON biker_routes;
CREATE POLICY "Admins manage biker_routes" ON biker_routes 
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage brand_crm_contacts" ON brand_crm_contacts;
CREATE POLICY "Admins manage brand_crm_contacts" ON brand_crm_contacts 
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage batch_upload_history" ON batch_upload_history;
CREATE POLICY "Admins manage batch_upload_history" ON batch_upload_history 
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage brand_inventory_movements" ON brand_inventory_movements;
CREATE POLICY "Admins manage brand_inventory_movements" ON brand_inventory_movements 
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage store_ai_insights" ON store_ai_insights;
CREATE POLICY "Admins manage store_ai_insights" ON store_ai_insights 
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Step 7: Create indexes
CREATE INDEX IF NOT EXISTS idx_store_brand_accounts_store ON store_brand_accounts(store_master_id);
CREATE INDEX IF NOT EXISTS idx_store_brand_accounts_brand ON store_brand_accounts(brand);
CREATE INDEX IF NOT EXISTS idx_biker_routes_date ON biker_routes(route_date);
CREATE INDEX IF NOT EXISTS idx_brand_crm_contacts_brand ON brand_crm_contacts(brand);
CREATE INDEX IF NOT EXISTS idx_store_ai_insights_store ON store_ai_insights(store_master_id);

-- Step 8: Create update triggers
DROP TRIGGER IF EXISTS update_store_master_updated_at ON store_master;
CREATE TRIGGER update_store_master_updated_at BEFORE UPDATE ON store_master
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_store_brand_accounts_updated_at ON store_brand_accounts;
CREATE TRIGGER update_store_brand_accounts_updated_at BEFORE UPDATE ON store_brand_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_biker_routes_updated_at ON biker_routes;
CREATE TRIGGER update_biker_routes_updated_at BEFORE UPDATE ON biker_routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_brand_crm_contacts_updated_at ON brand_crm_contacts;
CREATE TRIGGER update_brand_crm_contacts_updated_at BEFORE UPDATE ON brand_crm_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();