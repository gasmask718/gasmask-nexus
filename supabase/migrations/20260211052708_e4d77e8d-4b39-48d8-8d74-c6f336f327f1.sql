
-- PHASE 2 & 3: Add 'trialing' to relationship_health_enum, add brand_activated_at, add is_active sync trigger

-- Add 'trialing' to the enum
ALTER TYPE relationship_health_enum ADD VALUE IF NOT EXISTS 'trialing';

-- Add brand_activated_at column
ALTER TABLE public.store_brand_relationships
  ADD COLUMN IF NOT EXISTS brand_activated_at timestamptz NULL;

-- Create trigger to auto-sync is_active from relationship_health
CREATE OR REPLACE FUNCTION public.sync_brand_is_active()
RETURNS TRIGGER AS $$
BEGIN
  -- Derive is_active from relationship_health
  IF NEW.relationship_health IN ('paused', 'terminated') THEN
    NEW.is_active := false;
  ELSE
    NEW.is_active := true;
  END IF;

  -- Set brand_activated_at on activation transition
  IF OLD.relationship_health IN ('paused', 'terminated')
     AND NEW.relationship_health IN ('healthy', 'at_risk', 'trialing')
     AND (OLD.is_active = false OR OLD.brand_activated_at IS NULL) THEN
    NEW.brand_activated_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop if exists to avoid duplicate
DROP TRIGGER IF EXISTS sync_brand_is_active_trigger ON public.store_brand_relationships;

CREATE TRIGGER sync_brand_is_active_trigger
  BEFORE UPDATE ON public.store_brand_relationships
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_brand_is_active();
