-- Add inventory velocity tracking fields to store_product_state
ALTER TABLE store_product_state 
ADD COLUMN IF NOT EXISTS velocity_boxes_per_day numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS predicted_stockout_date date,
ADD COLUMN IF NOT EXISTS urgency_score integer DEFAULT 0 CHECK (urgency_score >= 0 AND urgency_score <= 100),
ADD COLUMN IF NOT EXISTS last_velocity_calculation timestamp with time zone;

-- Add route optimization fields to routes table
ALTER TABLE routes
ADD COLUMN IF NOT EXISTS estimated_distance_km numeric,
ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer,
ADD COLUMN IF NOT EXISTS estimated_profit numeric,
ADD COLUMN IF NOT EXISTS optimization_score integer,
ADD COLUMN IF NOT EXISTS is_optimized boolean DEFAULT false;

-- Add geofencing check-in tracking
CREATE TABLE IF NOT EXISTS location_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('arrival', 'departure', 'idle')),
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  distance_from_store_meters numeric
);

ALTER TABLE location_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own location events"
ON location_events FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own location events"
ON location_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add mobile session tracking
CREATE TABLE IF NOT EXISTS driver_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  route_id uuid REFERENCES routes(id) ON DELETE SET NULL,
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  total_stops_completed integer DEFAULT 0,
  total_distance_km numeric DEFAULT 0,
  is_active boolean DEFAULT true
);

ALTER TABLE driver_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
ON driver_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sessions"
ON driver_sessions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add inventory alerts table
CREATE TABLE IF NOT EXISTS inventory_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('stockout_imminent', 'high_velocity', 'low_velocity', 'urgent_reorder')),
  urgency_score integer NOT NULL,
  predicted_date date,
  message text,
  is_resolved boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone
);

ALTER TABLE inventory_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view inventory alerts"
ON inventory_alerts FOR SELECT
USING (true);

CREATE POLICY "Admins can manage inventory alerts"
ON inventory_alerts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_location_events_user_id ON location_events(user_id);
CREATE INDEX IF NOT EXISTS idx_location_events_store_id ON location_events(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_store_id ON inventory_alerts(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_unresolved ON inventory_alerts(is_resolved) WHERE is_resolved = false;