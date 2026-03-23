
-- Add result tracking columns to sbo_parlays
ALTER TABLE sbo_parlays 
  ADD COLUMN IF NOT EXISTS result text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS legs_won int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS legs_lost int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Add missing columns to sbo_parlay_builder
ALTER TABLE sbo_parlay_builder
  ADD COLUMN IF NOT EXISTS actual_payout numeric,
  ADD COLUMN IF NOT EXISTS legs_won int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS legs_lost int DEFAULT 0;
