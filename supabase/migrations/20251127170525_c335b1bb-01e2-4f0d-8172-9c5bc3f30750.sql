-- =====================================================
-- DYNASTY OS STORES SCHEMA UPGRADE
-- Adding new fields and tables for real-world Excel data
-- =====================================================

-- 1. ADD NEW COLUMNS TO STORES TABLE
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS store_code text,
ADD COLUMN IF NOT EXISTS neighborhood text,
ADD COLUMN IF NOT EXISTS boro text,
ADD COLUMN IF NOT EXISTS wholesaler_name text,
ADD COLUMN IF NOT EXISTS connected_group_id uuid,
ADD COLUMN IF NOT EXISTS sells_flowers boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS prime_time_energy boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS rpa_status text DEFAULT 'rpa',
ADD COLUMN IF NOT EXISTS notes_overview text,
ADD COLUMN IF NOT EXISTS notes_old text,
ADD COLUMN IF NOT EXISTS special_information text,
ADD COLUMN IF NOT EXISTS created_by text;

-- Add check constraint for rpa_status
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_rpa_status_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_rpa_status_check 
  CHECK (rpa_status IS NULL OR rpa_status IN ('rpa', 'notneededonrpa'));

-- 2. CREATE STORE_CONTACTS TABLE
CREATE TABLE IF NOT EXISTS public.store_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text DEFAULT 'worker',
  phone text,
  is_primary boolean DEFAULT false,
  can_receive_sms boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.store_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view store contacts" ON public.store_contacts
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage store contacts" ON public.store_contacts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- 3. CREATE STORE_TUBE_INVENTORY TABLE
CREATE TABLE IF NOT EXISTS public.store_tube_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  brand text NOT NULL,
  current_tubes_left integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_by text
);

ALTER TABLE public.store_tube_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tube inventory" ON public.store_tube_inventory
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage tube inventory" ON public.store_tube_inventory
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- 4. CREATE STORE_PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.store_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.wholesale_orders(id) ON DELETE SET NULL,
  issue_date timestamptz DEFAULT now(),
  due_date timestamptz,
  owed_amount numeric DEFAULT 0,
  paid_amount numeric DEFAULT 0,
  payment_status text DEFAULT 'unpaid',
  created_at timestamptz DEFAULT now(),
  created_by text
);

ALTER TABLE public.store_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view store payments" ON public.store_payments
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage store payments" ON public.store_payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- 5. ADD NEW COLUMNS TO WHOLESALE_ORDERS
ALTER TABLE public.wholesale_orders
ADD COLUMN IF NOT EXISTS brand text,
ADD COLUMN IF NOT EXISTS boxes integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS tubes_per_box integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS tubes_total integer GENERATED ALWAYS AS (boxes * tubes_per_box) STORED,
ADD COLUMN IF NOT EXISTS order_date timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS created_by text;

-- 6. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_stores_status ON public.stores(status);
CREATE INDEX IF NOT EXISTS idx_stores_city ON public.stores(address_city);
CREATE INDEX IF NOT EXISTS idx_stores_state ON public.stores(address_state);
CREATE INDEX IF NOT EXISTS idx_stores_boro ON public.stores(boro);
CREATE INDEX IF NOT EXISTS idx_stores_neighborhood ON public.stores(neighborhood);
CREATE INDEX IF NOT EXISTS idx_stores_rpa_status ON public.stores(rpa_status);
CREATE INDEX IF NOT EXISTS idx_stores_sells_flowers ON public.stores(sells_flowers);
CREATE INDEX IF NOT EXISTS idx_stores_prime_time ON public.stores(prime_time_energy);
CREATE INDEX IF NOT EXISTS idx_store_contacts_store_id ON public.store_contacts(store_id);
CREATE INDEX IF NOT EXISTS idx_store_tube_inventory_store_id ON public.store_tube_inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_store_payments_store_id ON public.store_payments(store_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_brand ON public.wholesale_orders(brand);
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_order_date ON public.wholesale_orders(order_date);