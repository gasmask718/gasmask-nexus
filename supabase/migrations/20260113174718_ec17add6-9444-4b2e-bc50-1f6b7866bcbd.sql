-- ============================================
-- UNIFIED PERSON ARCHITECTURE MIGRATION
-- Phase 1: Rename crm_contacts → people
-- Phase 2: Create person_roles junction table
-- Phase 3: Create role extension tables
-- Phase 4: Migrate existing type values to roles
-- ============================================

-- Phase 1: Rename identity table
ALTER TABLE crm_contacts RENAME TO people;

-- Phase 2: Create person_roles junction table (SINGLE source of truth for roles)
CREATE TABLE person_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role text NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  is_active boolean DEFAULT true,
  UNIQUE(person_id, role)
);

-- Index for fast role lookups
CREATE INDEX idx_person_roles_person_id ON person_roles(person_id);
CREATE INDEX idx_person_roles_role ON person_roles(role);
CREATE INDEX idx_person_roles_active ON person_roles(is_active) WHERE is_active = true;

-- Phase 3: Role extension tables
CREATE TABLE driver_role_data (
  person_id uuid PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
  vehicle_type text,
  license_number text,
  license_expiry date,
  region text,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE ambassador_role_data (
  person_id uuid PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
  tracking_code text UNIQUE,
  tier text DEFAULT 'starter',
  total_earnings numeric DEFAULT 0,
  commission_rate numeric DEFAULT 0.10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE biker_role_data (
  person_id uuid PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
  bike_type text,
  delivery_zone text,
  max_capacity_kg numeric,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Phase 4: Migrate existing type values to person_roles
INSERT INTO person_roles (person_id, role)
SELECT id, type
FROM people
WHERE type IS NOT NULL AND type != ''
ON CONFLICT DO NOTHING;

-- Enable RLS on new tables
ALTER TABLE person_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_role_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambassador_role_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE biker_role_data ENABLE ROW LEVEL SECURITY;

-- RLS policies for person_roles
CREATE POLICY "Authenticated users can view person_roles"
  ON person_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage person_roles"
  ON person_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND primary_role IN ('admin', 'owner', 'va')
    )
  );

-- RLS policies for driver_role_data
CREATE POLICY "Authenticated users can view driver_role_data"
  ON driver_role_data FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage driver_role_data"
  ON driver_role_data FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND primary_role IN ('admin', 'owner', 'va')
    )
  );

-- RLS policies for ambassador_role_data
CREATE POLICY "Authenticated users can view ambassador_role_data"
  ON ambassador_role_data FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage ambassador_role_data"
  ON ambassador_role_data FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND primary_role IN ('admin', 'owner', 'va')
    )
  );

-- RLS policies for biker_role_data
CREATE POLICY "Authenticated users can view biker_role_data"
  ON biker_role_data FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage biker_role_data"
  ON biker_role_data FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND primary_role IN ('admin', 'owner', 'va')
    )
  );

-- Update timestamp triggers for role extension tables
CREATE TRIGGER update_driver_role_data_updated_at
  BEFORE UPDATE ON driver_role_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ambassador_role_data_updated_at
  BEFORE UPDATE ON ambassador_role_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_biker_role_data_updated_at
  BEFORE UPDATE ON biker_role_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();