
ALTER TABLE dialer_intelligence_runs
ADD COLUMN IF NOT EXISTS adaptive_multiplier numeric,
ADD COLUMN IF NOT EXISTS adaptive_mode text,
ADD COLUMN IF NOT EXISTS effective_refresh_interval integer,
ADD COLUMN IF NOT EXISTS rolling_avg_impact numeric,
ADD COLUMN IF NOT EXISTS rolling_negative_ratio numeric;
