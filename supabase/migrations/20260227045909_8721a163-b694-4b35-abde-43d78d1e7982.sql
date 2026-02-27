
-- Target-Driven Profit Mode: settings + run columns
ALTER TABLE dialer_settings
  ADD COLUMN IF NOT EXISTS target_profit_7d numeric,
  ADD COLUMN IF NOT EXISTS target_mode_enabled boolean DEFAULT false;

ALTER TABLE dialer_intelligence_runs
  ADD COLUMN IF NOT EXISTS target_gap numeric,
  ADD COLUMN IF NOT EXISTS target_mode_action text;
