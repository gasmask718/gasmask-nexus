
CREATE TABLE IF NOT EXISTS visit_action_checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_id UUID REFERENCES gasmask_visit_triggers(id) ON DELETE CASCADE,
  store_id UUID,
  store_name TEXT NOT NULL,
  assigned_to TEXT,
  assigned_role TEXT CHECK (assigned_role IN ('driver', 'biker', 'ambassador', 'admin')),
  visit_objective TEXT NOT NULL,
  priority_actions JSONB DEFAULT '[]',
  products_to_bring JSONB DEFAULT '[]',
  talking_points JSONB DEFAULT '[]',
  things_to_check JSONB DEFAULT '[]',
  photos_required JSONB DEFAULT '[]',
  store_context TEXT,
  owner_name TEXT,
  owner_personality TEXT,
  best_approach TEXT,
  previous_issues TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  items_completed JSONB DEFAULT '[]',
  photos_taken JSONB DEFAULT '[]',
  outcome TEXT,
  follow_up_needed BOOLEAN DEFAULT FALSE,
  follow_up_notes TEXT,
  ai_generated BOOLEAN DEFAULT TRUE,
  ai_model TEXT DEFAULT 'claude-haiku-4-5-20251001',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checklist_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID REFERENCES visit_action_checklists(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_index INTEGER,
  item_text TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklist_trigger ON visit_action_checklists(trigger_id);
CREATE INDEX IF NOT EXISTS idx_checklist_assigned ON visit_action_checklists(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_checklist_store ON visit_action_checklists(store_name);

ALTER TABLE visit_action_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_access_checklists" ON visit_action_checklists FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_access_completions" ON checklist_completions FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE visit_action_checklists;
