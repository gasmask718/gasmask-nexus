
-- SECTION 1: Flexible Unit Completion columns
ALTER TABLE production_worker_tasks
  ADD COLUMN IF NOT EXISTS actual_units_completed INT NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS normalized_minutes_per_1000 NUMERIC,
  ADD COLUMN IF NOT EXISTS normalized_units_per_hour NUMERIC;

-- Update trigger to compute normalized metrics on completion
CREATE OR REPLACE FUNCTION fn_set_worker_task_duration()
RETURNS TRIGGER AS $$
DECLARE
  dur_secs INT;
  dur_mins NUMERIC;
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'running' THEN
    NEW.finished_at := COALESCE(NEW.finished_at, now());
    dur_secs := EXTRACT(EPOCH FROM (NEW.finished_at - NEW.started_at))::int;
    NEW.duration_seconds := dur_secs;
    
    dur_mins := dur_secs / 60.0;
    
    -- Guard against zero division
    IF NEW.actual_units_completed > 0 AND dur_mins > 0 THEN
      NEW.normalized_minutes_per_1000 := (dur_mins / NEW.actual_units_completed) * 1000;
      NEW.normalized_units_per_hour := (NEW.actual_units_completed / dur_mins) * 60;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- SECTION 5: Incentive-ready snapshots (frozen, immutable)
CREATE TABLE IF NOT EXISTS labor_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_user_id UUID NOT NULL,
  office_id UUID NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  avg_minutes_per_1000 NUMERIC NOT NULL,
  std_dev NUMERIC NOT NULL DEFAULT 0,
  performance_score NUMERIC NOT NULL DEFAULT 0,
  total_units_completed INT NOT NULL DEFAULT 0,
  total_hours NUMERIC NOT NULL DEFAULT 0,
  snapshot_created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE labor_performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read snapshots"
  ON labor_performance_snapshots FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "System inserts snapshots"
  ON labor_performance_snapshots FOR INSERT TO authenticated
  WITH CHECK (true);

-- SECTION 6: Anti-gaming anomaly events
CREATE TABLE IF NOT EXISTS labor_anomaly_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES production_worker_tasks(id),
  worker_user_id UUID NOT NULL,
  office_id UUID NOT NULL,
  anomaly_type TEXT NOT NULL, -- 'short_duration', 'high_units', 'excessive_voids'
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE labor_anomaly_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read anomalies"
  ON labor_anomaly_events FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "System inserts anomalies"
  ON labor_anomaly_events FOR INSERT TO authenticated
  WITH CHECK (true);

-- SECTION 3: Batch labor summary view
CREATE OR REPLACE VIEW v_batch_labor_summary AS
SELECT
  batch_id,
  office_id,
  COUNT(*) AS task_count,
  SUM(actual_units_completed) AS total_units_completed,
  SUM(duration_seconds) AS total_labor_seconds,
  ROUND(SUM(duration_seconds) / 3600.0, 2) AS total_labor_hours,
  CASE WHEN SUM(actual_units_completed) > 0 THEN
    ROUND((SUM(duration_seconds) / 60.0 / SUM(actual_units_completed)) * 1000, 2)
  ELSE NULL END AS avg_normalized_minutes_per_1000
FROM production_worker_tasks
WHERE status = 'completed'
  AND batch_id IS NOT NULL
  AND duration_seconds > 0
GROUP BY batch_id, office_id;

-- Backfill normalized metrics for existing completed tasks
UPDATE production_worker_tasks
SET
  normalized_minutes_per_1000 = CASE 
    WHEN actual_units_completed > 0 AND duration_seconds > 0 
    THEN ((duration_seconds / 60.0) / actual_units_completed) * 1000
    ELSE NULL END,
  normalized_units_per_hour = CASE
    WHEN actual_units_completed > 0 AND duration_seconds > 0
    THEN (actual_units_completed / (duration_seconds / 60.0)) * 60
    ELSE NULL END
WHERE status = 'completed' AND duration_seconds > 0 AND normalized_minutes_per_1000 IS NULL;
