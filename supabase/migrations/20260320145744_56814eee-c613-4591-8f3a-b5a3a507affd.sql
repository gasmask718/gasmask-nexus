
-- Master agent registry
CREATE TABLE IF NOT EXISTS dynasty_agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name TEXT NOT NULL UNIQUE,
  agent_type TEXT NOT NULL,
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5),
  brands TEXT[] DEFAULT '{}',
  floor_source TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  run_schedule TEXT,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  total_runs INTEGER DEFAULT 0,
  total_actions_taken INTEGER DEFAULT 0,
  avg_confidence NUMERIC(5,2) DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent run log
CREATE TABLE IF NOT EXISTS dynasty_agent_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES dynasty_agents(id),
  agent_name TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running',
  actions_taken INTEGER DEFAULT 0,
  insights_generated INTEGER DEFAULT 0,
  triggers_fired INTEGER DEFAULT 0,
  summary TEXT,
  full_output JSONB DEFAULT '{}',
  error_message TEXT,
  cost_estimate NUMERIC(8,6) DEFAULT 0
);

-- Agent actions log
CREATE TABLE IF NOT EXISTS dynasty_agent_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name TEXT NOT NULL,
  run_id UUID REFERENCES dynasty_agent_runs(id),
  action_type TEXT NOT NULL,
  action_target TEXT,
  action_data JSONB DEFAULT '{}',
  outcome TEXT,
  confidence INTEGER DEFAULT 80,
  requires_human_approval BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent insights/advisory
CREATE TABLE IF NOT EXISTS dynasty_agent_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name TEXT NOT NULL,
  brand TEXT,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  action_required BOOLEAN DEFAULT FALSE,
  action_taken BOOLEAN DEFAULT FALSE,
  dismissed BOOLEAN DEFAULT FALSE,
  related_store TEXT,
  related_record_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed agent registry
INSERT INTO dynasty_agents (agent_name, agent_type, tier, brands, run_schedule)
VALUES
('CEO Briefing Agent', 'command', 1, ARRAY['GasMask','Hot Mama Grabba','Grabba R Us','Hot Scalatti'], '0 6 * * *'),
('Revenue Intelligence Agent', 'intelligence', 1, ARRAY['GasMask','Hot Mama Grabba','Grabba R Us','Hot Scalatti'], '0 8 * * *'),
('Account Health Agent', 'crm', 2, ARRAY['GasMask','Hot Mama Grabba','Grabba R Us','Hot Scalatti'], '0 7 * * *'),
('Inventory Intelligence Agent', 'inventory', 2, ARRAY['GasMask','Hot Mama Grabba','Grabba R Us','Hot Scalatti'], '0 */4 * * *'),
('Territory Expansion Agent', 'territory', 2, ARRAY['GasMask','Hot Mama Grabba','Grabba R Us','Hot Scalatti'], '0 9 * * 1'),
('Follow-Up Cadence Agent', 'crm', 2, ARRAY['GasMask','Hot Mama Grabba','Grabba R Us','Hot Scalatti'], '0 8 * * *'),
('Complaint Resolution Agent', 'comms', 2, ARRAY['GasMask','Hot Mama Grabba','Grabba R Us','Hot Scalatti'], '*/30 * * * *'),
('Route Planning Agent', 'delivery', 4, ARRAY['GasMask','Hot Mama Grabba','Grabba R Us','Hot Scalatti'], '0 7 * * *'),
('Collections Agent', 'finance', 4, ARRAY['GasMask','Hot Mama Grabba','Grabba R Us','Hot Scalatti'], '0 9 * * 1,3,5'),
('Sell-Through Agent', 'inventory', 4, ARRAY['GasMask','Hot Mama Grabba','Grabba R Us','Hot Scalatti'], '0 6 * * 1'),
('Onboarding Agent', 'crm', 4, ARRAY['GasMask','Hot Mama Grabba','Grabba R Us','Hot Scalatti'], '0 9 * * *'),
('Market Intelligence Agent', 'intelligence', 5, ARRAY['GasMask','Hot Mama Grabba','Grabba R Us','Hot Scalatti'], '0 6 * * 1'),
('Pricing Optimization Agent', 'intelligence', 5, ARRAY['GasMask','Hot Mama Grabba','Grabba R Us','Hot Scalatti'], '0 6 * * 1'),
('Financial Ops Agent', 'finance', 5, ARRAY['GasMask','Hot Mama Grabba','Grabba R Us','Hot Scalatti'], '0 20 * * *')
ON CONFLICT (agent_name) DO NOTHING;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE dynasty_agent_insights;
ALTER PUBLICATION supabase_realtime ADD TABLE dynasty_agent_runs;

-- RLS
ALTER TABLE dynasty_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynasty_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynasty_agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynasty_agent_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access dynasty_agents" ON dynasty_agents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read dynasty_agents" ON dynasty_agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated update dynasty_agents" ON dynasty_agents FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access dynasty_agent_runs" ON dynasty_agent_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read dynasty_agent_runs" ON dynasty_agent_runs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role full access dynasty_agent_actions" ON dynasty_agent_actions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read dynasty_agent_actions" ON dynasty_agent_actions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role full access dynasty_agent_insights" ON dynasty_agent_insights FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read dynasty_agent_insights" ON dynasty_agent_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated update dynasty_agent_insights" ON dynasty_agent_insights FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
