
-- Add MAO generated column to re_leads (drop first if exists from prior migration without it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 're_leads' AND column_name = 'mao'
  ) THEN
    ALTER TABLE re_leads ADD COLUMN mao NUMERIC GENERATED ALWAYS AS (arv * 0.70 - COALESCE(estimated_repairs, 0)) STORED;
  END IF;
END $$;

-- Update deal_score check constraint to allow empty string
ALTER TABLE re_leads DROP CONSTRAINT IF EXISTS re_leads_deal_score_check;
ALTER TABLE re_leads ADD CONSTRAINT re_leads_deal_score_check CHECK (deal_score IS NULL OR deal_score IN ('A','B','C','D',''));

-- Add GIN index on buyer states
CREATE INDEX IF NOT EXISTS idx_re_buyers_states ON re_buyers USING gin(states);
