
-- ============================================================
-- PRODUCTION CONTROL HARDENING — MASTER MIGRATION
-- Sections 1-6: Ledger view, batch state history, material usage,
-- equipment assignments, daily production summary, production goals
-- ============================================================

-- SECTION 1: Full Batch Cost Ledger View (latest version per batch)
CREATE OR REPLACE VIEW public.v_batch_cost_history_latest AS
SELECT DISTINCT ON (batch_id)
  bch.*
FROM public.batch_cost_history bch
ORDER BY bch.batch_id, bch.version DESC;

-- SECTION 2: Batch State History (for reopen tracking)
CREATE TABLE IF NOT EXISTS public.batch_state_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  reason TEXT,
  performed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.batch_state_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view batch state history"
  ON public.batch_state_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert batch state history"
  ON public.batch_state_history FOR INSERT TO authenticated WITH CHECK (true);

-- SECTION 3: Production Material Usage
DO $$ BEGIN
  CREATE TYPE public.material_type_enum AS ENUM (
    'tobacco_lbs', 'tubes', 'bags', 'stickers', 'boxes', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.production_material_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID,
  office_id UUID NOT NULL,
  material_type public.material_type_enum NOT NULL,
  quantity_used NUMERIC NOT NULL DEFAULT 0,
  unit_of_measure TEXT NOT NULL DEFAULT 'units',
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
ALTER TABLE public.production_material_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view material usage"
  ON public.production_material_usage FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert material usage"
  ON public.production_material_usage FOR INSERT TO authenticated WITH CHECK (true);

-- Material usage aggregation views
CREATE OR REPLACE VIEW public.v_material_usage_daily AS
SELECT
  usage_date,
  office_id,
  material_type::text AS material_type,
  SUM(quantity_used) AS total_used
FROM public.production_material_usage
GROUP BY usage_date, office_id, material_type;

CREATE OR REPLACE VIEW public.v_material_usage_total AS
SELECT
  office_id,
  material_type::text AS material_type,
  SUM(quantity_used) AS lifetime_used
FROM public.production_material_usage
GROUP BY office_id, material_type;

-- SECTION 4: Equipment Assignments
CREATE TABLE IF NOT EXISTS public.production_equipment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL,
  equipment_name TEXT NOT NULL,
  equipment_serial TEXT,
  assigned_to_user_id UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  assignment_notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.production_equipment_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view equipment assignments"
  ON public.production_equipment_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert equipment assignments"
  ON public.production_equipment_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update equipment assignments"
  ON public.production_equipment_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- SECTION 5: Daily Production Summary (Supervisor Entry)
CREATE TABLE IF NOT EXISTS public.daily_production_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL,
  production_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supervisor_user_id UUID,
  workers_present INT NOT NULL DEFAULT 0,
  boxes_completed NUMERIC NOT NULL DEFAULT 0,
  tobacco_lbs_used NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(office_id, production_date)
);
ALTER TABLE public.daily_production_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view daily production summary"
  ON public.daily_production_summary FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert daily production summary"
  ON public.daily_production_summary FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update daily production summary"
  ON public.daily_production_summary FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Add daily_goal to production_offices
ALTER TABLE public.production_offices 
  ADD COLUMN IF NOT EXISTS daily_box_goal NUMERIC DEFAULT 100;

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_material_usage;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_production_summary;
