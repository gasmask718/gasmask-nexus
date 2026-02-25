-- Worker Task Timer: Full Schema + Triggers + RLS

DO $$ BEGIN CREATE TYPE public.worker_task_type AS ENUM ('sleeving', 'sticker', 'sleeving_and_sticker'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.worker_task_status AS ENUM ('running', 'completed', 'voided'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.worker_task_event_type AS ENUM ('start', 'finish', 'void', 'edit_note'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE production_worker_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES production_offices(id),
  worker_user_id UUID NOT NULL REFERENCES auth.users(id),
  worker_display_name TEXT,
  task_type worker_task_type NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'tubes',
  standard_unit_label TEXT NOT NULL DEFAULT 'box_1000',
  standard_unit_quantity INT NOT NULL DEFAULT 1000,
  brand TEXT,
  batch_id UUID REFERENCES production_batches(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_seconds INT,
  notes TEXT,
  status worker_task_status NOT NULL DEFAULT 'running',
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX idx_unique_running_task ON production_worker_tasks (office_id, worker_user_id) WHERE status = 'running';

CREATE TABLE production_worker_task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES production_worker_tasks(id) ON DELETE CASCADE,
  event_type worker_task_event_type NOT NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID REFERENCES auth.users(id),
  payload_json JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE production_labor_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID REFERENCES production_offices(id),
  task_type worker_task_type NOT NULL,
  baseline_minutes_per_1000 NUMERIC NOT NULL DEFAULT 0,
  sample_count INT NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_labor_baseline_unique ON production_labor_baselines (COALESCE(office_id, '00000000-0000-0000-0000-000000000000'::uuid), task_type);

-- Trigger: compute duration on finish
CREATE OR REPLACE FUNCTION fn_set_worker_task_duration() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'running' THEN
    NEW.finished_at := COALESCE(NEW.finished_at, now());
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.finished_at - NEW.started_at))::int;
    IF NEW.duration_seconds <= 0 THEN RAISE EXCEPTION 'Duration must be positive'; END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_worker_task_duration BEFORE UPDATE ON production_worker_tasks FOR EACH ROW EXECUTE FUNCTION fn_set_worker_task_duration();

-- Trigger: auto-log events
CREATE OR REPLACE FUNCTION fn_log_worker_task_event() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO production_worker_task_events (task_id, event_type, actor_user_id) VALUES (NEW.id, 'start', NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND OLD.status::text != NEW.status::text THEN
    INSERT INTO production_worker_task_events (task_id, event_type, actor_user_id, payload_json)
    VALUES (NEW.id,
      CASE NEW.status::text WHEN 'completed' THEN 'finish'::worker_task_event_type WHEN 'voided' THEN 'void'::worker_task_event_type ELSE 'edit_note'::worker_task_event_type END,
      auth.uid(),
      jsonb_build_object('old_status', OLD.status::text, 'new_status', NEW.status::text, 'void_reason', NEW.void_reason, 'duration_seconds', NEW.duration_seconds)
    );
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_worker_task_event AFTER INSERT OR UPDATE ON production_worker_tasks FOR EACH ROW EXECUTE FUNCTION fn_log_worker_task_event();

-- RLS
ALTER TABLE production_worker_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_worker_task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_labor_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers read own tasks" ON production_worker_tasks FOR SELECT TO authenticated
  USING (worker_user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'));
CREATE POLICY "Workers insert own tasks" ON production_worker_tasks FOR INSERT TO authenticated
  WITH CHECK (worker_user_id = auth.uid() AND created_by = auth.uid());
CREATE POLICY "Workers update own running tasks" ON production_worker_tasks FOR UPDATE TO authenticated
  USING (worker_user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'));

CREATE POLICY "Read task events" ON production_worker_task_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM production_worker_tasks t WHERE t.id = task_id AND (t.worker_user_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'))));
CREATE POLICY "Insert task events" ON production_worker_task_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Read labor baselines" ON production_labor_baselines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin insert labor baselines" ON production_labor_baselines FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'));
CREATE POLICY "Admin update labor baselines" ON production_labor_baselines FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner'));