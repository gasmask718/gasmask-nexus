-- =============================================
-- TUBE INVENTORY INTELLIGENCE SYSTEM
-- Master Table: store_tube_inventory_status
-- =============================================

-- Create the store_tube_inventory_status table
CREATE TABLE public.store_tube_inventory_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  brand_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  
  -- Inventory tracking
  current_tubes_left INTEGER DEFAULT 0,
  last_order_date DATE,
  
  -- Operational intelligence flags
  product_introduced BOOLEAN NOT NULL DEFAULT FALSE,
  owner_interested BOOLEAN, -- NULL = not asked, TRUE/FALSE = response
  needs_order BOOLEAN NOT NULL DEFAULT FALSE,
  bring_samples BOOLEAN NOT NULL DEFAULT FALSE,
  bring_starter_kit BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Derived/stored status
  has_ever_ordered BOOLEAN NOT NULL DEFAULT FALSE,
  starter_kit_delivered BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Audit fields
  last_updated_by UUID REFERENCES auth.users(id),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Simulation isolation
  is_simulation BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Unique constraint: one record per store + brand
  UNIQUE (store_id, brand_id, is_simulation)
);

-- Enable RLS
ALTER TABLE public.store_tube_inventory_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Owners/Admins: Full access
CREATE POLICY "Owners and admins have full access to tube intel"
ON public.store_tube_inventory_status
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin')
  )
);

-- Ambassadors: Read + Update (specific fields via application layer)
CREATE POLICY "Ambassadors can view and update tube intel"
ON public.store_tube_inventory_status
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'ambassador'
  )
);

-- Bikers: Read + Update (specific fields via application layer)
CREATE POLICY "Bikers can view and update tube intel"
ON public.store_tube_inventory_status
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'biker'
  )
);

-- Drivers: Read-only
CREATE POLICY "Drivers can view tube intel"
ON public.store_tube_inventory_status
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'driver'
  )
);

-- VAs: Full access
CREATE POLICY "VAs have full access to tube intel"
ON public.store_tube_inventory_status
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'va'
  )
);

-- Indexes for performance
CREATE INDEX idx_tube_intel_store_id ON public.store_tube_inventory_status(store_id);
CREATE INDEX idx_tube_intel_brand_id ON public.store_tube_inventory_status(brand_id);
CREATE INDEX idx_tube_intel_needs_order ON public.store_tube_inventory_status(needs_order) WHERE needs_order = TRUE;
CREATE INDEX idx_tube_intel_bring_samples ON public.store_tube_inventory_status(bring_samples) WHERE bring_samples = TRUE;
CREATE INDEX idx_tube_intel_bring_starter ON public.store_tube_inventory_status(bring_starter_kit) WHERE bring_starter_kit = TRUE;
CREATE INDEX idx_tube_intel_simulation ON public.store_tube_inventory_status(is_simulation);

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_tube_inventory_status;

-- Create audit log table for tube intel changes
CREATE TABLE public.store_tube_intel_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tube_intel_id UUID NOT NULL REFERENCES public.store_tube_inventory_status(id) ON DELETE CASCADE,
  store_id UUID NOT NULL,
  brand_id TEXT NOT NULL,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for audit table (read-only for most, write via trigger)
ALTER TABLE public.store_tube_intel_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and owners can view tube intel audit"
ON public.store_tube_intel_audit
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('owner', 'admin', 'va')
  )
);

-- Trigger function to auto-log changes
CREATE OR REPLACE FUNCTION public.log_tube_intel_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log field changes
  IF OLD.product_introduced IS DISTINCT FROM NEW.product_introduced THEN
    INSERT INTO store_tube_intel_audit (tube_intel_id, store_id, brand_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, NEW.store_id, NEW.brand_id, 'product_introduced', OLD.product_introduced::text, NEW.product_introduced::text, auth.uid());
  END IF;
  
  IF OLD.owner_interested IS DISTINCT FROM NEW.owner_interested THEN
    INSERT INTO store_tube_intel_audit (tube_intel_id, store_id, brand_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, NEW.store_id, NEW.brand_id, 'owner_interested', OLD.owner_interested::text, NEW.owner_interested::text, auth.uid());
  END IF;
  
  IF OLD.needs_order IS DISTINCT FROM NEW.needs_order THEN
    INSERT INTO store_tube_intel_audit (tube_intel_id, store_id, brand_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, NEW.store_id, NEW.brand_id, 'needs_order', OLD.needs_order::text, NEW.needs_order::text, auth.uid());
  END IF;
  
  IF OLD.bring_samples IS DISTINCT FROM NEW.bring_samples THEN
    INSERT INTO store_tube_intel_audit (tube_intel_id, store_id, brand_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, NEW.store_id, NEW.brand_id, 'bring_samples', OLD.bring_samples::text, NEW.bring_samples::text, auth.uid());
  END IF;
  
  IF OLD.bring_starter_kit IS DISTINCT FROM NEW.bring_starter_kit THEN
    INSERT INTO store_tube_intel_audit (tube_intel_id, store_id, brand_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, NEW.store_id, NEW.brand_id, 'bring_starter_kit', OLD.bring_starter_kit::text, NEW.bring_starter_kit::text, auth.uid());
  END IF;
  
  IF OLD.starter_kit_delivered IS DISTINCT FROM NEW.starter_kit_delivered THEN
    INSERT INTO store_tube_intel_audit (tube_intel_id, store_id, brand_id, field_changed, old_value, new_value, changed_by)
    VALUES (NEW.id, NEW.store_id, NEW.brand_id, 'starter_kit_delivered', OLD.starter_kit_delivered::text, NEW.starter_kit_delivered::text, auth.uid());
  END IF;
  
  -- Update timestamp and user
  NEW.last_updated_at = now();
  NEW.last_updated_by = auth.uid();
  
  RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER trg_log_tube_intel_changes
BEFORE UPDATE ON public.store_tube_inventory_status
FOR EACH ROW
EXECUTE FUNCTION public.log_tube_intel_changes();

-- Comment on table
COMMENT ON TABLE public.store_tube_inventory_status IS 'Tube Inventory Intelligence System - Operational signals per store/brand for route planning and field operations';