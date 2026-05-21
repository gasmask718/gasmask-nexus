
-- 1. tt_partners: router partner_type + lifecycle flags
ALTER TABLE public.tt_partners
  ADD COLUMN IF NOT EXISTS partner_type text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.tt_partners.partner_type IS
  'Router partner pool key: chauffeur, sedan, suv, exotic_supplier, sprinter_operator, party_bus_operator, coach_operator, watercraft_operator, novelty_operator, florist, photographer, ...';
COMMENT ON COLUMN public.tt_partners.service_category IS
  'Coarse vertical bucket (transport/hospitality/etc). Distinct from partner_type.';

CREATE OR REPLACE FUNCTION public.tt_partners_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('pending','approved','active','suspended','archived') THEN
    RAISE EXCEPTION 'tt_partners.status invalid: % (allowed: pending,approved,active,suspended,archived)', NEW.status;
  END IF;
  RETURN NEW;
END$$;
DROP TRIGGER IF EXISTS trg_tt_partners_validate ON public.tt_partners;
CREATE TRIGGER trg_tt_partners_validate
  BEFORE INSERT OR UPDATE ON public.tt_partners
  FOR EACH ROW EXECUTE FUNCTION public.tt_partners_validate();

CREATE INDEX IF NOT EXISTS idx_tt_partners_partner_type
  ON public.tt_partners(partner_type) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_tt_partners_status
  ON public.tt_partners(status);

-- 2. tt_vehicles: ownership + classification + dispatch model
ALTER TABLE public.tt_vehicles
  ADD COLUMN IF NOT EXISTS owner_partner_id uuid REFERENCES public.tt_partners(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS vehicle_class text,
  ADD COLUMN IF NOT EXISTS dispatch_model text;

COMMENT ON COLUMN public.tt_vehicles.vehicle_class IS
  'Normalized class: black_truck, sedan, suv, sprinter, party_bus, coach, exotic_car, watercraft, novelty';
COMMENT ON COLUMN public.tt_vehicles.dispatch_model IS
  'pool = dispatches to driver pool (black_truck/suv/sprinter/coach). asset = dispatches to specific owner_partner_id (exotic, novelty).';

CREATE OR REPLACE FUNCTION public.tt_vehicles_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.dispatch_model IS NOT NULL AND NEW.dispatch_model NOT IN ('pool','asset') THEN
    RAISE EXCEPTION 'tt_vehicles.dispatch_model must be pool|asset, got %', NEW.dispatch_model;
  END IF;
  IF NEW.dispatch_model = 'asset' AND NEW.owner_partner_id IS NULL THEN
    RAISE EXCEPTION 'asset-model vehicle requires owner_partner_id';
  END IF;
  RETURN NEW;
END$$;
DROP TRIGGER IF EXISTS trg_tt_vehicles_validate ON public.tt_vehicles;
CREATE TRIGGER trg_tt_vehicles_validate
  BEFORE INSERT OR UPDATE ON public.tt_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.tt_vehicles_validate();

CREATE INDEX IF NOT EXISTS idx_tt_vehicles_owner
  ON public.tt_vehicles(owner_partner_id);
CREATE INDEX IF NOT EXISTS idx_tt_vehicles_class
  ON public.tt_vehicles(vehicle_class) WHERE is_active;

-- 3. tt_drivers: explicit partner ownership + class capability
ALTER TABLE public.tt_drivers
  ADD COLUMN IF NOT EXISTS owner_partner_id uuid REFERENCES public.tt_partners(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS vehicle_classes text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.tt_drivers.owner_partner_id IS
  'Partner this driver belongs to (chauffeur pool owner). NULL = unaffiliated/marketplace driver.';
COMMENT ON COLUMN public.tt_drivers.vehicle_classes IS
  'Vehicle classes this driver is qualified to operate (e.g. {black_truck,suv}).';

CREATE INDEX IF NOT EXISTS idx_tt_drivers_owner
  ON public.tt_drivers(owner_partner_id);
CREATE INDEX IF NOT EXISTS idx_tt_drivers_classes
  ON public.tt_drivers USING GIN(vehicle_classes);
