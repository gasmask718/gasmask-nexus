
-- Ambassador Territory Coverage (structured region mapping)
CREATE TYPE public.territory_region_type AS ENUM ('state', 'county', 'city', 'custom_zone');

CREATE TABLE public.ambassador_territory_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  region_type territory_region_type NOT NULL DEFAULT 'city',
  region_value TEXT NOT NULL,
  coverage_radius_miles INT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(ambassador_id, region_type, region_value)
);

-- Audit log for territory changes
CREATE TABLE public.ambassador_region_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('added', 'removed', 'updated')),
  old_value JSONB,
  new_value JSONB,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Influencer profile tracking columns
ALTER TABLE public.influencers 
  ADD COLUMN IF NOT EXISTS profile_last_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_last_updated_by UUID REFERENCES auth.users(id);

-- Index for birthday queries (future campaign automation)
CREATE INDEX IF NOT EXISTS idx_influencers_dob ON public.influencers(date_of_birth);

-- Index for territory lookups
CREATE INDEX IF NOT EXISTS idx_territory_coverage_ambassador ON public.ambassador_territory_coverage(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_territory_coverage_region ON public.ambassador_territory_coverage(region_type, region_value);

-- Updated_at trigger for territory coverage
CREATE OR REPLACE FUNCTION public.update_territory_coverage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_territory_coverage_updated
  BEFORE UPDATE ON public.ambassador_territory_coverage
  FOR EACH ROW EXECUTE FUNCTION public.update_territory_coverage_timestamp();

-- RLS
ALTER TABLE public.ambassador_territory_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_region_history ENABLE ROW LEVEL SECURITY;

-- Admin/elevated can manage territory coverage
CREATE POLICY "Elevated roles manage territory coverage" ON public.ambassador_territory_coverage
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Read access for authenticated users
CREATE POLICY "Authenticated read territory coverage" ON public.ambassador_territory_coverage
  FOR SELECT TO authenticated
  USING (true);

-- Admin manages audit log
CREATE POLICY "Elevated roles manage region history" ON public.ambassador_region_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Read access for region history
CREATE POLICY "Authenticated read region history" ON public.ambassador_region_history
  FOR SELECT TO authenticated
  USING (true);
