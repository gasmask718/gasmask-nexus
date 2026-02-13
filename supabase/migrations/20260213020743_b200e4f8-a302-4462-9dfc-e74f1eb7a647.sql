
-- ═══════════════════════════════════════════════════════════════════════════════
-- FLOOR 4 MULTI-BRAND DELIVERY INTEGRATION
-- Extends routes + route_stops with brand metadata (informational only)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add brand context to routes (array of brand IDs/names included)
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS brand_ids TEXT[] DEFAULT '{}';

-- Add brand context per stop
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS brand_id TEXT;
ALTER TABLE public.route_stops ADD COLUMN IF NOT EXISTS order_ids TEXT[] DEFAULT '{}';

-- Index for brand-aware queries
CREATE INDEX IF NOT EXISTS idx_routes_brand_ids ON public.routes USING GIN(brand_ids);
CREATE INDEX IF NOT EXISTS idx_route_stops_brand_id ON public.route_stops(brand_id);
