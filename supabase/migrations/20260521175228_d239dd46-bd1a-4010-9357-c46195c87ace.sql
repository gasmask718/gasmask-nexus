
-- =========================================================================
-- STEP 2.1 — Dispatch pattern schema
-- =========================================================================

ALTER TABLE public.tt_vehicles
  ADD COLUMN IF NOT EXISTS style text;

COMMENT ON COLUMN public.tt_vehicles.style IS
  'Sub-class for pool_style matching: trucks=matte_black|matte_grey|tahoe|suburban|escalade; sprinters=executive|luxury|passenger; etc.';

CREATE INDEX IF NOT EXISTS idx_tt_vehicles_style
  ON public.tt_vehicles(style) WHERE is_active = true;

ALTER TABLE public.tt_partners
  ADD COLUMN IF NOT EXISTS styles_offered  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_regions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS profit_margin   numeric;

COMMENT ON COLUMN public.tt_partners.styles_offered  IS 'DERIVED rollup of distinct styles across active vehicles owned by this partner. Maintained by tt_vehicles trigger.';
COMMENT ON COLUMN public.tt_partners.service_regions IS 'States/areas covered for quote_region & broadcast_hold dispatch.';
COMMENT ON COLUMN public.tt_partners.profit_margin   IS 'Used by asset_fallback ranking (higher margin tried first when owner unavailable).';

CREATE INDEX IF NOT EXISTS idx_tt_partners_styles_offered  ON public.tt_partners USING GIN(styles_offered)  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tt_partners_service_regions ON public.tt_partners USING GIN(service_regions) WHERE is_active = true;

ALTER TABLE public.tt_drivers
  ADD COLUMN IF NOT EXISTS styles_offered text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_tt_drivers_styles_offered
  ON public.tt_drivers USING GIN(styles_offered);

ALTER TABLE public.tt_service_routing
  ADD COLUMN IF NOT EXISTS dispatch_pattern text;

CREATE OR REPLACE FUNCTION public.tt_service_routing_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.dispatch_pattern IS NOT NULL
     AND NEW.dispatch_pattern NOT IN
         ('pool_style','asset_fallback','hybrid','quote_region','broadcast_hold')
  THEN
    RAISE EXCEPTION 'Invalid dispatch_pattern %: must be one of pool_style|asset_fallback|hybrid|quote_region|broadcast_hold', NEW.dispatch_pattern;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tt_service_routing_validate ON public.tt_service_routing;
CREATE TRIGGER trg_tt_service_routing_validate
  BEFORE INSERT OR UPDATE ON public.tt_service_routing
  FOR EACH ROW EXECUTE FUNCTION public.tt_service_routing_validate();

UPDATE public.tt_service_routing SET dispatch_pattern = CASE slug
  WHEN 'black-truck'  THEN 'pool_style'
  WHEN 'exotic-cars'  THEN 'asset_fallback'
  WHEN 'sprinters'    THEN 'hybrid'
  WHEN 'party-bus'    THEN 'asset_fallback'
  WHEN 'private-jet'  THEN 'quote_region'
  WHEN 'yachts'       THEN 'asset_fallback'
  WHEN 'helicopter'   THEN 'broadcast_hold'
  WHEN 'coach-bus'    THEN 'quote_region'
  WHEN 'jetski'       THEN 'broadcast_hold'
  WHEN 'slingshot'    THEN 'broadcast_hold'
END
WHERE slug IN ('black-truck','exotic-cars','sprinters','party-bus',
               'private-jet','yachts','helicopter','coach-bus',
               'jetski','slingshot');

-- Vehicle validation (pattern-aware; styles_offered is derived, NOT gated)
CREATE OR REPLACE FUNCTION public.tt_vehicles_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_owner_regions text[];
BEGIN
  IF NEW.dispatch_model IS NULL THEN RETURN NEW; END IF;

  IF NEW.dispatch_model NOT IN
     ('pool_style','asset_fallback','hybrid','quote_region','broadcast_hold')
  THEN
    RAISE EXCEPTION 'Invalid dispatch_model %: must be one of pool_style|asset_fallback|hybrid|quote_region|broadcast_hold', NEW.dispatch_model;
  END IF;

  IF NEW.dispatch_model IN ('asset_fallback','hybrid')
     AND NEW.owner_partner_id IS NULL
  THEN
    RAISE EXCEPTION 'dispatch_model=% requires owner_partner_id', NEW.dispatch_model;
  END IF;

  IF NEW.dispatch_model = 'pool_style'
     AND (NEW.style IS NULL OR length(trim(NEW.style)) = 0)
  THEN
    RAISE EXCEPTION 'dispatch_model=pool_style requires vehicle.style';
  END IF;

  IF NEW.dispatch_model IN ('quote_region','broadcast_hold')
     AND NEW.owner_partner_id IS NOT NULL
  THEN
    SELECT service_regions INTO v_owner_regions
      FROM public.tt_partners WHERE id = NEW.owner_partner_id;
    IF v_owner_regions IS NULL OR array_length(v_owner_regions,1) IS NULL THEN
      RAISE EXCEPTION 'Owner partner % requires service_regions for dispatch_model=%', NEW.owner_partner_id, NEW.dispatch_model;
    END IF;
  END IF;

  RETURN NEW;
END $$;

-- =========================================================================
-- STEP 2.2 — Amenity columns + capability rollup
-- =========================================================================

ALTER TABLE public.tt_vehicles
  ADD COLUMN IF NOT EXISTS star_ceiling boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS red_carpet   boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tt_vehicles.star_ceiling IS 'Fiber-optic star headliner amenity.';
COMMENT ON COLUMN public.tt_vehicles.red_carpet   IS 'Red carpet rollout on arrival.';

CREATE INDEX IF NOT EXISTS idx_tt_vehicles_star_ceiling ON public.tt_vehicles(id) WHERE star_ceiling = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_tt_vehicles_red_carpet   ON public.tt_vehicles(id) WHERE red_carpet   = true AND is_active = true;

ALTER TABLE public.tt_drivers
  ADD COLUMN IF NOT EXISTS star_ceiling boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS red_carpet   boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tt_drivers_star_ceiling ON public.tt_drivers(id) WHERE star_ceiling = true;
CREATE INDEX IF NOT EXISTS idx_tt_drivers_red_carpet   ON public.tt_drivers(id) WHERE red_carpet   = true;

ALTER TABLE public.tt_partners
  ADD COLUMN IF NOT EXISTS offers_star_ceiling boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offers_red_carpet   boolean NOT NULL DEFAULT false;

-- Capability rollup: derives styles_offered + offers_* from active vehicles
CREATE OR REPLACE FUNCTION public.tt_partners_refresh_capabilities(_partner_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF _partner_id IS NULL THEN RETURN; END IF;
  UPDATE public.tt_partners p
     SET offers_star_ceiling = COALESCE((
           SELECT bool_or(v.star_ceiling) FROM public.tt_vehicles v
            WHERE v.owner_partner_id = _partner_id AND v.is_active = true), false),
         offers_red_carpet   = COALESCE((
           SELECT bool_or(v.red_carpet)   FROM public.tt_vehicles v
            WHERE v.owner_partner_id = _partner_id AND v.is_active = true), false),
         styles_offered      = COALESCE((
           SELECT array_agg(DISTINCT v.style ORDER BY v.style)
             FROM public.tt_vehicles v
            WHERE v.owner_partner_id = _partner_id
              AND v.is_active = true
              AND v.style IS NOT NULL
              AND length(trim(v.style)) > 0), '{}')
   WHERE p.id = _partner_id;
END $$;

CREATE OR REPLACE FUNCTION public.tt_vehicles_capability_rollup()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.tt_partners_refresh_capabilities(NEW.owner_partner_id);
  IF TG_OP = 'UPDATE' AND OLD.owner_partner_id IS DISTINCT FROM NEW.owner_partner_id THEN
    PERFORM public.tt_partners_refresh_capabilities(OLD.owner_partner_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tt_vehicles_capability_rollup ON public.tt_vehicles;
CREATE TRIGGER trg_tt_vehicles_capability_rollup
  AFTER INSERT OR UPDATE OF star_ceiling, red_carpet, style, owner_partner_id, is_active
  ON public.tt_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.tt_vehicles_capability_rollup();

-- Booking payload — nullable filter fields (NULL = don't care)
ALTER TABLE public.tt_bookings
  ADD COLUMN IF NOT EXISTS requested_star_ceiling boolean,
  ADD COLUMN IF NOT EXISTS requested_red_carpet   boolean;

COMMENT ON COLUMN public.tt_bookings.requested_star_ceiling IS 'NULL=no filter; TRUE=only match vehicles/partners with star_ceiling=true.';
COMMENT ON COLUMN public.tt_bookings.requested_red_carpet   IS 'NULL=no filter; TRUE=only match vehicles/partners with red_carpet=true.';
