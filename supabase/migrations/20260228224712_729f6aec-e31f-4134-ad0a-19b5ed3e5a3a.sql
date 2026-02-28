-- Add pickup_probability column to follow_up_execution_targets for intelligence-driven ordering
ALTER TABLE follow_up_execution_targets
ADD COLUMN IF NOT EXISTS pickup_probability real DEFAULT NULL;