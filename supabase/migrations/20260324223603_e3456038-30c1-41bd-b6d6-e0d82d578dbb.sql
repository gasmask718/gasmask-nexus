
-- Platform settings table
CREATE TABLE IF NOT EXISTS platform_settings (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_name TEXT NOT NULL DEFAULT 'Dynasty Connect',
  platform_desc TEXT,
  version       TEXT DEFAULT '1.0',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Business pipelines table
CREATE TABLE IF NOT EXISTS dc_business_pipelines (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name   TEXT NOT NULL,
  caller_id       TEXT NOT NULL,
  default_agent_id TEXT,
  pipeline_type   TEXT CHECK (pipeline_type IN ('internal','external')),
  status          TEXT DEFAULT 'active',
  description     TEXT,
  monthly_rate    NUMERIC DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to playbook_history
ALTER TABLE playbook_history
  ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'dynasty_connect';

CREATE INDEX IF NOT EXISTS idx_playbook_history_date
  ON playbook_history(date DESC);

-- Add missing columns to ai_call_logs
ALTER TABLE ai_call_logs
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'dynasty_connect',
  ADD COLUMN IF NOT EXISTS full_transcript TEXT;
