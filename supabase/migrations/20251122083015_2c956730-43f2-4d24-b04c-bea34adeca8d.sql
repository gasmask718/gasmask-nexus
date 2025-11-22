-- Phase 8: Multi-State Expansion AI - Database Schema (Fixed)

-- 1. Regions table
CREATE TABLE IF NOT EXISTS public.regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  country TEXT DEFAULT 'US',
  state TEXT NOT NULL,
  primary_city TEXT,
  city_cluster TEXT[],
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','paused','retired')),
  launch_date DATE,
  target_store_count INTEGER,
  target_monthly_volume NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage regions" ON public.regions;
CREATE POLICY "Admins can manage regions"
  ON public.regions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 2. Region scorecards
CREATE TABLE IF NOT EXISTS public.region_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  store_count INTEGER DEFAULT 0,
  active_store_count INTEGER DEFAULT 0,
  avg_store_health INTEGER,
  avg_driver_health INTEGER,
  route_efficiency_score INTEGER,
  weekly_volume_estimated NUMERIC,
  penetration_score INTEGER,
  potential_score INTEGER,
  priority_rank INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (region_id, snapshot_date)
);

ALTER TABLE public.region_scorecards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read scorecards" ON public.region_scorecards;
CREATE POLICY "Admins can read scorecards"
  ON public.region_scorecards FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "System can insert scorecards" ON public.region_scorecards;
CREATE POLICY "System can insert scorecards"
  ON public.region_scorecards FOR INSERT
  WITH CHECK (true);

-- 3. ZIP / territory density
CREATE TABLE IF NOT EXISTS public.zip_density (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zip_code TEXT NOT NULL,
  city TEXT,
  state TEXT,
  region_id UUID REFERENCES public.regions(id),
  store_count INTEGER DEFAULT 0,
  prospect_store_count INTEGER DEFAULT 0,
  population_estimate INTEGER,
  density_score INTEGER,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(zip_code, state)
);

ALTER TABLE public.zip_density ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read zip density" ON public.zip_density;
CREATE POLICY "Admins can read zip density"
  ON public.zip_density FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "System can manage zip density" ON public.zip_density;
CREATE POLICY "System can manage zip density"
  ON public.zip_density FOR ALL
  USING (true)
  WITH CHECK (true);

-- 4. Regional ambassadors
CREATE TABLE IF NOT EXISTS public.ambassador_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  region_id UUID NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'ambassador',
  commission_rate NUMERIC,
  active BOOLEAN DEFAULT true,
  stats JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ambassador_id, region_id)
);

ALTER TABLE public.ambassador_regions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage ambassador regions" ON public.ambassador_regions;
CREATE POLICY "Admins manage ambassador regions"
  ON public.ambassador_regions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 5. Augment existing tables
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES public.regions(id),
  ADD COLUMN IF NOT EXISTS market_code TEXT,
  ADD COLUMN IF NOT EXISTS open_date DATE,
  ADD COLUMN IF NOT EXISTS last_active_date DATE;

ALTER TABLE public.wholesale_hubs
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES public.regions(id);

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS primary_region_id UUID REFERENCES public.regions(id),
  ADD COLUMN IF NOT EXISTS supported_regions UUID[];