ALTER TABLE brandaro_leads_master 
  ADD COLUMN IF NOT EXISTS assigned_locked_until timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS lock_assigned_by text DEFAULT NULL;