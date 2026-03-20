
-- Master visit trigger table
CREATE TABLE IF NOT EXISTS gasmask_visit_triggers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID,
  store_name TEXT NOT NULL,
  store_address TEXT,
  store_city TEXT,
  store_state TEXT,
  store_lat NUMERIC(10,7),
  store_lng NUMERIC(10,7),
  store_phone TEXT,
  trigger_source TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  floor_source TEXT NOT NULL,
  urgency TEXT DEFAULT 'normal',
  priority_score INTEGER DEFAULT 5,
  ai_recommendation TEXT,
  ai_confidence INTEGER DEFAULT 80,
  visit_duration_minutes INTEGER DEFAULT 20,
  status TEXT DEFAULT 'pending',
  assigned_driver_id UUID,
  assigned_driver_name TEXT,
  route_id UUID,
  route_position INTEGER,
  earliest_visit_at TIMESTAMPTZ,
  latest_visit_at TIMESTAMPTZ,
  scheduled_for DATE,
  completed_at TIMESTAMPTZ,
  trigger_notes TEXT,
  completion_notes TEXT,
  source_record_id UUID,
  source_record_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triggers_status ON gasmask_visit_triggers(status);
CREATE INDEX IF NOT EXISTS idx_triggers_store_id ON gasmask_visit_triggers(store_id);
CREATE INDEX IF NOT EXISTS idx_triggers_urgency ON gasmask_visit_triggers(urgency, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_triggers_scheduled ON gasmask_visit_triggers(scheduled_for);

-- Route runs table
CREATE TABLE IF NOT EXISTS gasmask_route_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_name TEXT,
  driver_id UUID,
  driver_name TEXT,
  scheduled_date DATE NOT NULL,
  status TEXT DEFAULT 'planning',
  total_stops INTEGER DEFAULT 0,
  completed_stops INTEGER DEFAULT 0,
  estimated_duration_minutes INTEGER DEFAULT 0,
  actual_start_at TIMESTAMPTZ,
  actual_end_at TIMESTAMPTZ,
  route_notes TEXT,
  optimized_order JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger rules table
CREATE TABLE IF NOT EXISTS gasmask_trigger_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name TEXT NOT NULL,
  floor_source TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  urgency TEXT DEFAULT 'normal',
  priority_score INTEGER DEFAULT 5,
  visit_duration_minutes INTEGER DEFAULT 20,
  is_active BOOLEAN DEFAULT TRUE,
  conditions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE gasmask_visit_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE gasmask_route_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gasmask_trigger_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access visit triggers" ON gasmask_visit_triggers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access visit triggers" ON gasmask_visit_triggers FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access route runs" ON gasmask_route_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access route runs" ON gasmask_route_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated full access trigger rules" ON gasmask_trigger_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access trigger rules" ON gasmask_trigger_rules FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE gasmask_visit_triggers;
ALTER PUBLICATION supabase_realtime ADD TABLE gasmask_route_runs;

-- Seed trigger rules
INSERT INTO gasmask_trigger_rules (rule_name, floor_source, trigger_type, urgency, priority_score, visit_duration_minutes) VALUES
('Follow-up cadence due', 'floor1_crm', 'follow_up', 'high', 7, 20),
('Opportunity stalled', 'floor1_crm', 'follow_up', 'normal', 5, 30),
('Account health critical', 'floor1_crm', 'urgent_visit', 'critical', 10, 45),
('New store first visit', 'floor1_crm', 'first_visit', 'high', 8, 60),
('Low stock alert', 'floor2_inventory', 'restock', 'high', 8, 15),
('Product expiry urgent', 'floor2_inventory', 'urgent_visit', 'critical', 10, 20),
('Inventory discrepancy', 'floor2_inventory', 'audit', 'normal', 6, 30),
('Unresolved complaint 24h', 'floor3_comms', 'complaint', 'critical', 10, 30),
('No answer after 3 calls', 'floor3_comms', 'follow_up', 'high', 7, 20),
('Territory gap prospect', 'floor5_territory', 'prospecting', 'normal', 5, 45),
('Commitment not fulfilled', 'floor5_territory', 'follow_up', 'high', 7, 25),
('AI escalation flag', 'floor9_ai_ops', 'ai_flag', 'critical', 10, 30),
('Risk radar intervention', 'floor9_ai_ops', 'urgent_visit', 'critical', 10, 45);
