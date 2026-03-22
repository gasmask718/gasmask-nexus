
alter table sbo_predictions
  add column if not exists weights_used jsonb;

-- brain_count column already exists from prior migration, ensure it's there
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sbo_predictions' AND column_name = 'brain_count') THEN
    ALTER TABLE sbo_predictions ADD COLUMN brain_count integer DEFAULT 3;
  END IF;
END $$;
