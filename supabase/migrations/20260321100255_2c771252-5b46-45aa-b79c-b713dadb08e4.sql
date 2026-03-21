ALTER TABLE checklist_tube_intelligence
  ADD COLUMN IF NOT EXISTS inventory_checked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS inventory_checked_at timestamptz;