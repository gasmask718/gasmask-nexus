-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE app_role AS ENUM ('admin', 'csr', 'driver', 'biker', 'ambassador', 'wholesaler', 'warehouse', 'accountant');
CREATE TYPE store_status AS ENUM ('active', 'inactive', 'prospect', 'needsFollowUp');
CREATE TYPE store_type AS ENUM ('bodega', 'smoke_shop', 'gas_station', 'wholesaler', 'other');
CREATE TYPE responsiveness AS ENUM ('call', 'text', 'both', 'none');
CREATE TYPE sticker_status AS ENUM ('none', 'doorOnly', 'inStoreOnly', 'doorAndInStore');
CREATE TYPE inventory_level AS ENUM ('empty', 'quarter', 'half', 'threeQuarters', 'full');
CREATE TYPE visit_type AS ENUM ('delivery', 'inventoryCheck', 'coldLead', 'followUp');
CREATE TYPE payment_method AS ENUM ('cash', 'zelle', 'cashapp', 'venmo', 'other');

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role app_role NOT NULL DEFAULT 'driver',
  preferred_language TEXT DEFAULT 'en',
  shirt_size TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Brands table
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#FF0000',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view brands"
  ON brands FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify brands"
  ON brands FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  unit_type TEXT NOT NULL,
  wholesale_price DECIMAL(10,2),
  suggested_retail_price DECIMAL(10,2),
  weight_per_unit DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view products"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify products"
  ON products FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Stores table
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type store_type NOT NULL,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  address_country TEXT DEFAULT 'USA',
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  primary_contact_name TEXT,
  phone TEXT,
  alt_phone TEXT,
  email TEXT,
  notes TEXT,
  status store_status DEFAULT 'prospect',
  responsiveness responsiveness DEFAULT 'none',
  sticker_status sticker_status DEFAULT 'none',
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view stores"
  ON stores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "CSR and above can modify stores"
  ON stores FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'csr', 'driver', 'biker')
  ));

-- Store product state table
CREATE TABLE store_product_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  last_inventory_level inventory_level DEFAULT 'empty',
  last_inventory_check_at TIMESTAMPTZ,
  average_sellthrough_days INTEGER,
  next_estimated_reorder_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, product_id)
);

ALTER TABLE store_product_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view store product state"
  ON store_product_state FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Field workers can update inventory"
  ON store_product_state FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'driver', 'biker', 'csr')
  ));

-- Routes table
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  type TEXT NOT NULL,
  assigned_to UUID REFERENCES profiles(id),
  territory TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view routes"
  ON routes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and assigned users can modify routes"
  ON routes FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR assigned_to = auth.uid()
  );

-- Route stops table
CREATE TABLE route_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id),
  planned_order INTEGER NOT NULL,
  planned_arrival_time TIME,
  notes_to_worker TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view route stops"
  ON route_stops FOR SELECT
  TO authenticated
  USING (true);

-- Visit logs table
CREATE TABLE visit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID REFERENCES stores(id),
  user_id UUID REFERENCES profiles(id),
  visit_type visit_type NOT NULL,
  visit_datetime TIMESTAMPTZ DEFAULT NOW(),
  products_delivered JSONB,
  cash_collected DECIMAL(10,2),
  payment_method payment_method,
  new_phone_number TEXT,
  inventory_levels JSONB,
  sticker_status_update sticker_status,
  photos TEXT[],
  customer_response TEXT,
  flags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE visit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visit logs"
  ON visit_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Field workers can create visit logs"
  ON visit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_product_state_updated_at
  BEFORE UPDATE ON store_product_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'driver')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();