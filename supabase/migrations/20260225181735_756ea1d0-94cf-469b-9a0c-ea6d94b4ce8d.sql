
-- ═══════════════════════════════════════════════════════════════
-- PRODUCT-RESERVED MATERIAL POOLS — Tables + View
-- ═══════════════════════════════════════════════════════════════

-- 1. Raw Material Inventory (single source of truth per office)
CREATE TABLE IF NOT EXISTS public.raw_material_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.production_offices(id),
  material_type TEXT NOT NULL DEFAULT 'tobacco',
  total_lbs_available NUMERIC NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(office_id, material_type)
);

ALTER TABLE public.raw_material_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read raw_material_inventory"
  ON public.raw_material_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert raw_material_inventory"
  ON public.raw_material_inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update raw_material_inventory"
  ON public.raw_material_inventory FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 2. Material Allocations (logical reservation per product_type)
CREATE TABLE IF NOT EXISTS public.raw_material_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.production_offices(id),
  product_type TEXT NOT NULL CHECK (product_type IN ('tubes', 'bags')),
  reserved_lbs NUMERIC NOT NULL DEFAULT 0,
  auto_reserved_lbs NUMERIC NOT NULL DEFAULT 0,
  manual_reserved_lbs NUMERIC NOT NULL DEFAULT 0,
  coverage_target_days INTEGER NOT NULL DEFAULT 30,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(office_id, product_type)
);

ALTER TABLE public.raw_material_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read raw_material_allocations"
  ON public.raw_material_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert raw_material_allocations"
  ON public.raw_material_allocations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update raw_material_allocations"
  ON public.raw_material_allocations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 3. Allocation Override Audit Log
CREATE TABLE IF NOT EXISTS public.raw_allocation_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES public.production_offices(id),
  product_type TEXT NOT NULL CHECK (product_type IN ('tubes', 'bags')),
  previous_reserved_lbs NUMERIC NOT NULL,
  new_reserved_lbs NUMERIC NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.raw_allocation_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read raw_allocation_overrides"
  ON public.raw_allocation_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert raw_allocation_overrides"
  ON public.raw_allocation_overrides FOR INSERT TO authenticated WITH CHECK (true);

-- 4. Allocation overview view
CREATE OR REPLACE VIEW public.v_material_allocation_overview AS
SELECT
  inv.office_id,
  inv.material_type,
  inv.total_lbs_available,
  COALESCE(tubes.reserved_lbs, 0) AS tubes_reserved_lbs,
  COALESCE(bags.reserved_lbs, 0) AS bags_reserved_lbs,
  inv.total_lbs_available
    - COALESCE(tubes.reserved_lbs, 0)
    - COALESCE(bags.reserved_lbs, 0) AS unallocated_lbs,
  CASE WHEN inv.total_lbs_available > 0
    THEN ROUND(
      (inv.total_lbs_available - COALESCE(tubes.reserved_lbs, 0) - COALESCE(bags.reserved_lbs, 0))
      / inv.total_lbs_available * 100, 1
    )
    ELSE 0
  END AS unallocated_pct,
  COALESCE(tubes.coverage_target_days, 30) AS tubes_coverage_target,
  COALESCE(bags.coverage_target_days, 30) AS bags_coverage_target,
  COALESCE(tubes.auto_reserved_lbs, 0) AS tubes_auto_reserved,
  COALESCE(tubes.manual_reserved_lbs, 0) AS tubes_manual_reserved,
  COALESCE(bags.auto_reserved_lbs, 0) AS bags_auto_reserved,
  COALESCE(bags.manual_reserved_lbs, 0) AS bags_manual_reserved,
  inv.last_updated_at
FROM public.raw_material_inventory inv
LEFT JOIN public.raw_material_allocations tubes
  ON tubes.office_id = inv.office_id AND tubes.product_type = 'tubes'
LEFT JOIN public.raw_material_allocations bags
  ON bags.office_id = inv.office_id AND bags.product_type = 'bags'
WHERE inv.material_type = 'tobacco';
