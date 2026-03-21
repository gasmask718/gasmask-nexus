
-- contact_profiles table
CREATE TABLE IF NOT EXISTS contact_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  store_master_id UUID,
  business_name TEXT NOT NULL,
  owner_name TEXT,
  phone_primary TEXT,
  phone_secondary TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  boro TEXT,
  primary_brand TEXT DEFAULT 'GasMask',
  all_brands TEXT[] DEFAULT '{}',
  account_type TEXT DEFAULT 'store',
  relationship_score INTEGER DEFAULT 50,
  relationship_tier TEXT DEFAULT 'warm',
  last_contact_at TIMESTAMPTZ,
  last_contact_type TEXT,
  last_order_at TIMESTAMPTZ,
  last_visit_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ,
  followup_cadence_days INTEGER DEFAULT 14,
  personality_notes TEXT,
  preferences TEXT,
  best_contact_time TEXT,
  best_contact_method TEXT DEFAULT 'sms',
  total_orders INTEGER DEFAULT 0,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  lifetime_value NUMERIC(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_vip BOOLEAN DEFAULT FALSE,
  do_not_contact BOOLEAN DEFAULT FALSE,
  opted_out BOOLEAN DEFAULT FALSE,
  assigned_agent TEXT DEFAULT 'Relationship Agent',
  last_agent_action_at TIMESTAMPTZ,
  agent_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- contact_interactions table
CREATE TABLE IF NOT EXISTS contact_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contact_profiles(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL,
  direction TEXT DEFAULT 'outbound',
  subject TEXT,
  content TEXT,
  outcome TEXT,
  sentiment TEXT DEFAULT 'neutral',
  performed_by TEXT DEFAULT 'system',
  performed_by_type TEXT DEFAULT 'agent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- relationship_tasks table
CREATE TABLE IF NOT EXISTS relationship_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contact_profiles(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL DEFAULT 'send_checkin_sms',
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal',
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  ai_suggested_message TEXT,
  ai_reasoning TEXT,
  assigned_to TEXT DEFAULT 'Relationship Agent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- communication_drafts table
CREATE TABLE IF NOT EXISTS communication_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT DEFAULT 'store',
  entity_id UUID,
  channel TEXT DEFAULT 'sms',
  direction TEXT DEFAULT 'outbound',
  subject TEXT,
  message_body TEXT NOT NULL,
  recipient TEXT,
  sender TEXT DEFAULT 'Dynasty OS',
  status TEXT DEFAULT 'draft',
  requires_approval BOOLEAN DEFAULT TRUE,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  sent_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE contact_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_access_contacts" ON contact_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_access_interactions" ON contact_interactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_access_tasks" ON relationship_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_access_drafts" ON communication_drafts FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE contact_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE relationship_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE communication_drafts;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contact_tier ON contact_profiles(relationship_tier);
CREATE INDEX IF NOT EXISTS idx_contact_next_followup ON contact_profiles(next_followup_at);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON communication_drafts(status);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON relationship_tasks(status);

-- Auto-populate from stores table
INSERT INTO contact_profiles (
  store_id, business_name, phone_primary, address, city, state, boro,
  primary_brand, account_type, relationship_score, relationship_tier,
  last_visit_at, is_active, next_followup_at
)
SELECT 
  s.id, s.name, s.phone, s.address_street, s.address_city, s.address_state, s.boro,
  'GasMask', 'store',
  COALESCE(s.health_score, 50),
  CASE 
    WHEN COALESCE(s.health_score,50) >= 80 THEN 'vip'
    WHEN COALESCE(s.health_score,50) >= 60 THEN 'active'
    WHEN COALESCE(s.health_score,50) >= 40 THEN 'warm'
    WHEN COALESCE(s.health_score,50) >= 20 THEN 'cold'
    ELSE 'at_risk'
  END,
  s.last_visit_date,
  COALESCE(s.status = 'active', true),
  NOW() + INTERVAL '14 days'
FROM stores s
WHERE s.name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM contact_profiles cp WHERE cp.store_id = s.id
  )
ON CONFLICT DO NOTHING;
