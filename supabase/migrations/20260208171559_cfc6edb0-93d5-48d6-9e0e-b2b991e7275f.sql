
-- ═══════════════════════════════════════════════════════════════════════
-- FLOOR 6 PHASE 1: Raw Material Intake + Inventory State Machine
-- ═══════════════════════════════════════════════════════════════════════

-- 1) Raw Material Intake Table
CREATE TABLE public.production_raw_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.production_offices(id) ON DELETE CASCADE,
  material_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'lbs',
  cost_per_unit NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  supplier_name TEXT,
  supplier_id UUID,
  received_by TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  batch_number TEXT,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast office + material lookups
CREATE INDEX idx_raw_materials_office ON public.production_raw_materials(office_id);
CREATE INDEX idx_raw_materials_type ON public.production_raw_materials(material_type);
CREATE INDEX idx_raw_materials_received ON public.production_raw_materials(received_at DESC);

-- RLS
ALTER TABLE public.production_raw_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view raw materials"
  ON public.production_raw_materials FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert raw materials"
  ON public.production_raw_materials FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update raw materials"
  ON public.production_raw_materials FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete raw materials"
  ON public.production_raw_materials FOR DELETE
  TO authenticated USING (true);

-- 2) Add inventory_state column to production_batches
ALTER TABLE public.production_batches
  ADD COLUMN IF NOT EXISTS inventory_state TEXT NOT NULL DEFAULT 'raw';

-- Index for state-based filtering (CRM hard gate)
CREATE INDEX idx_batches_inventory_state ON public.production_batches(inventory_state);

-- 3) Inventory State Transitions Audit Log
CREATE TABLE public.production_inventory_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  transitioned_by UUID,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transitions_batch ON public.production_inventory_transitions(batch_id);
CREATE INDEX idx_transitions_created ON public.production_inventory_transitions(created_at DESC);

-- RLS
ALTER TABLE public.production_inventory_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view transitions"
  ON public.production_inventory_transitions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert transitions"
  ON public.production_inventory_transitions FOR INSERT
  TO authenticated WITH CHECK (true);

-- 4) Updated_at trigger for raw materials
CREATE TRIGGER update_production_raw_materials_updated_at
  BEFORE UPDATE ON public.production_raw_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
