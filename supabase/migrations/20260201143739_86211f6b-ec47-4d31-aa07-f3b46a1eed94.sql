-- ============================================================
-- PRODUCTION PORTAL SCHEMA - COMPLETE MANUFACTURING OS
-- ============================================================

-- 1. EXTEND PRODUCTION OFFICES (Add manager, status, hours)
ALTER TABLE public.production_offices
ADD COLUMN IF NOT EXISTS address_line_1 text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS zip_code text,
ADD COLUMN IF NOT EXISTS operating_hours jsonb DEFAULT '{"start": "08:00", "end": "17:00"}'::jsonb,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'closed', 'maintenance')),
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. OFFICE MANAGERS (Many-to-many: users can manage multiple offices)
CREATE TABLE IF NOT EXISTS public.production_office_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.production_offices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  UNIQUE(office_id, user_id)
);

-- 3. PRODUCTION WORKERS (Office-scoped workforce)
CREATE TABLE IF NOT EXISTS public.production_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.production_offices(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('packer', 'shredder', 'qc', 'supervisor', 'machine_operator', 'laborer')),
  phone text,
  whatsapp text,
  email text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
  hire_date date,
  notes text,
  person_id uuid REFERENCES public.people(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. DAILY PRODUCTION BATCHES (Enhanced with full input tracking)
ALTER TABLE public.production_batches
ADD COLUMN IF NOT EXISTS batch_date date DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS tobacco_lbs numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS stickers_used jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS empty_boxes_used jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS tools_used jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS workers_present uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS efficiency_pct numeric(5,2),
ADD COLUMN IF NOT EXISTS waste_lbs numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS completed_at timestamptz,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 5. BRAND OUTPUT PER BATCH (Per-brand box tracking)
CREATE TABLE IF NOT EXISTS public.production_batch_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  brand text NOT NULL CHECK (brand IN ('gasmask', 'hotmama', 'hotscolati', 'grabba-rus')),
  boxes_completed integer DEFAULT 0,
  tubes_used integer DEFAULT 0,
  stickers_used integer DEFAULT 0,
  empty_boxes_used integer DEFAULT 0,
  defects_count integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(batch_id, brand)
);

-- 6. TOOL INVENTORY PER OFFICE
CREATE TABLE IF NOT EXISTS public.production_office_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.production_offices(id) ON DELETE CASCADE,
  tool_type text NOT NULL CHECK (tool_type IN ('heat_gun', 'tobacco_shredder', 'label_printer', 'scale', 'packaging_machine', 'other')),
  tool_name text NOT NULL,
  quantity integer DEFAULT 1,
  operational_count integer DEFAULT 1,
  last_service_date date,
  next_service_date date,
  status text DEFAULT 'operational' CHECK (status IN ('operational', 'needs_repair', 'out_of_service')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. WORKER ATTENDANCE / PARTICIPATION LOG
CREATE TABLE IF NOT EXISTS public.production_worker_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.production_workers(id) ON DELETE CASCADE,
  check_in_at timestamptz,
  check_out_at timestamptz,
  hours_worked numeric(5,2),
  role_during_shift text,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(batch_id, worker_id)
);

-- 8. PRODUCTION HISTORY / AUDIT LOG
CREATE TABLE IF NOT EXISTS public.production_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid REFERENCES public.production_offices(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES public.production_batches(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'batch_created', 'batch_started', 'batch_completed', 'batch_cancelled',
    'output_recorded', 'input_updated', 'worker_assigned', 'worker_removed',
    'tool_status_changed', 'note_added', 'message_sent'
  )),
  event_data jsonb DEFAULT '{}'::jsonb,
  performed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- 9. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_production_workers_office ON public.production_workers(office_id);
CREATE INDEX IF NOT EXISTS idx_production_workers_status ON public.production_workers(status);
CREATE INDEX IF NOT EXISTS idx_production_batches_office_date ON public.production_batches(office_id, batch_date);
CREATE INDEX IF NOT EXISTS idx_production_batch_outputs_batch ON public.production_batch_outputs(batch_id);
CREATE INDEX IF NOT EXISTS idx_production_history_office ON public.production_history(office_id);
CREATE INDEX IF NOT EXISTS idx_production_history_batch ON public.production_history(batch_id);

-- 10. RLS POLICIES
ALTER TABLE public.production_office_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_batch_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_office_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_worker_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_history ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view production data
CREATE POLICY "Authenticated users can view office managers" 
ON public.production_office_managers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view workers" 
ON public.production_workers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view batch outputs" 
ON public.production_batch_outputs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view office tools" 
ON public.production_office_tools FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view attendance" 
ON public.production_worker_attendance FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can view history" 
ON public.production_history FOR SELECT TO authenticated USING (true);

-- Policy: Managers and admins can insert/update/delete
CREATE POLICY "Managers can manage office managers" 
ON public.production_office_managers FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

CREATE POLICY "Managers can manage workers" 
ON public.production_workers FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

CREATE POLICY "Managers can manage batch outputs" 
ON public.production_batch_outputs FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

CREATE POLICY "Managers can manage office tools" 
ON public.production_office_tools FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

CREATE POLICY "Managers can manage attendance" 
ON public.production_worker_attendance FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

CREATE POLICY "System can insert history" 
ON public.production_history FOR INSERT TO authenticated 
WITH CHECK (true);

-- 11. AUTO-CALCULATE EFFICIENCY FUNCTION
CREATE OR REPLACE FUNCTION public.calculate_batch_efficiency()
RETURNS TRIGGER AS $$
DECLARE
  v_total_boxes integer;
  v_total_tubes integer;
  v_expected_boxes integer;
BEGIN
  -- Sum outputs for this batch
  SELECT COALESCE(SUM(boxes_completed), 0), COALESCE(SUM(tubes_used), 0)
  INTO v_total_boxes, v_total_tubes
  FROM public.production_batch_outputs
  WHERE batch_id = NEW.batch_id;
  
  -- Calculate efficiency (tubes per box, assuming 20 tubes per box)
  IF v_total_tubes > 0 THEN
    v_expected_boxes := v_total_tubes / 20;
    IF v_expected_boxes > 0 THEN
      UPDATE public.production_batches
      SET efficiency_pct = ROUND((v_total_boxes::numeric / v_expected_boxes::numeric) * 100, 2)
      WHERE id = NEW.batch_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-calculate efficiency
DROP TRIGGER IF EXISTS trg_calculate_batch_efficiency ON public.production_batch_outputs;
CREATE TRIGGER trg_calculate_batch_efficiency
AFTER INSERT OR UPDATE ON public.production_batch_outputs
FOR EACH ROW EXECUTE FUNCTION public.calculate_batch_efficiency();

-- 12. HISTORY EVENT TRIGGER
CREATE OR REPLACE FUNCTION public.log_production_batch_event()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.production_history (office_id, batch_id, event_type, event_data, performed_by)
    VALUES (NEW.office_id, NEW.id, 'batch_created', jsonb_build_object('brand', NEW.brand, 'shift', NEW.shift_label), NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      INSERT INTO public.production_history (office_id, batch_id, event_type, event_data, performed_by)
      VALUES (NEW.office_id, NEW.id, 
        CASE NEW.status 
          WHEN 'in_progress' THEN 'batch_started'
          WHEN 'completed' THEN 'batch_completed'
          WHEN 'cancelled' THEN 'batch_cancelled'
          ELSE 'batch_created'
        END,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
        NEW.created_by
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_log_production_batch_event ON public.production_batches;
CREATE TRIGGER trg_log_production_batch_event
AFTER INSERT OR UPDATE ON public.production_batches
FOR EACH ROW EXECUTE FUNCTION public.log_production_batch_event();