
-- ============================================
-- GEO IDENTITIES: Canonical address resolution cache
-- ============================================
CREATE TABLE public.geo_identities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  formatted_address TEXT NOT NULL,
  street TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  neighborhood TEXT,
  borough TEXT,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  region_id UUID REFERENCES public.regions(id),
  region_name TEXT,
  source TEXT NOT NULL DEFAULT 'mapbox',
  verified BOOLEAN NOT NULL DEFAULT false,
  raw_input TEXT,
  last_geo_check TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT geo_identities_source_check CHECK (source IN ('google', 'mapbox', 'osm', 'manual'))
);

-- Index for dedup lookups
CREATE INDEX idx_geo_identities_coords ON public.geo_identities (latitude, longitude);
CREATE INDEX idx_geo_identities_formatted ON public.geo_identities (formatted_address);
CREATE INDEX idx_geo_identities_region ON public.geo_identities (region_id);

-- Enable RLS
ALTER TABLE public.geo_identities ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users
CREATE POLICY "Authenticated users can view geo identities"
  ON public.geo_identities FOR SELECT
  TO authenticated
  USING (true);

-- Insert/update for service role only (edge functions)
CREATE POLICY "Service role can manage geo identities"
  ON public.geo_identities FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Timestamp trigger
CREATE TRIGGER update_geo_identities_updated_at
  BEFORE UPDATE ON public.geo_identities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Add geo_id FK to entities
-- ============================================
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS geo_id UUID REFERENCES public.geo_identities(id);

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS geo_id UUID REFERENCES public.geo_identities(id),
  ADD COLUMN IF NOT EXISTS lat NUMERIC,
  ADD COLUMN IF NOT EXISTS lng NUMERIC;

-- Check if drivers table exists and add columns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'drivers') THEN
    EXECUTE 'ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS geo_id UUID REFERENCES public.geo_identities(id)';
    EXECUTE 'ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS neighborhood TEXT';
    EXECUTE 'ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS city TEXT';
    EXECUTE 'ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS state TEXT';
    EXECUTE 'ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS lat NUMERIC';
    EXECUTE 'ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS lng NUMERIC';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bikers') THEN
    EXECUTE 'ALTER TABLE public.bikers ADD COLUMN IF NOT EXISTS geo_id UUID REFERENCES public.geo_identities(id)';
    EXECUTE 'ALTER TABLE public.bikers ADD COLUMN IF NOT EXISTS neighborhood TEXT';
    EXECUTE 'ALTER TABLE public.bikers ADD COLUMN IF NOT EXISTS city TEXT';
    EXECUTE 'ALTER TABLE public.bikers ADD COLUMN IF NOT EXISTS state TEXT';
    EXECUTE 'ALTER TABLE public.bikers ADD COLUMN IF NOT EXISTS lat NUMERIC';
    EXECUTE 'ALTER TABLE public.bikers ADD COLUMN IF NOT EXISTS lng NUMERIC';
  END IF;
END $$;

-- ============================================
-- Unresolved geo queue view for ops cleanup
-- ============================================
CREATE OR REPLACE VIEW public.v_unresolved_geo_entities AS
SELECT 'store' AS entity_type, id AS entity_id, name AS entity_name,
  address_street AS raw_address, address_city AS city, address_state AS state, 
  lat, lng, geo_id
FROM public.stores
WHERE geo_id IS NULL AND (address_street IS NOT NULL OR address_city IS NOT NULL)
UNION ALL
SELECT 'influencer' AS entity_type, id AS entity_id, name AS entity_name,
  NULL AS raw_address, city, state,
  lat, lng, geo_id
FROM public.influencers
WHERE geo_id IS NULL AND (city IS NOT NULL OR neighborhood IS NOT NULL);
