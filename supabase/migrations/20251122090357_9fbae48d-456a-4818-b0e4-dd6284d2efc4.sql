-- Create route_performance_snapshots table
CREATE TABLE IF NOT EXISTS public.route_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  date DATE NOT NULL,
  driver_id UUID REFERENCES public.profiles(id),
  total_routes INTEGER DEFAULT 0,
  total_stops INTEGER DEFAULT 0,
  completed_stops INTEGER DEFAULT 0,
  completion_rate NUMERIC DEFAULT 0,
  avg_route_duration_minutes INTEGER,
  avg_distance_km NUMERIC,
  late_checkins_count INTEGER DEFAULT 0,
  missed_stops_count INTEGER DEFAULT 0,
  efficiency_score INTEGER DEFAULT 50 CHECK (efficiency_score >= 0 AND efficiency_score <= 100),
  coverage_score INTEGER DEFAULT 50 CHECK (coverage_score >= 0 AND coverage_score <= 100),
  notes TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_route_perf_driver_date ON public.route_performance_snapshots(driver_id, date);
CREATE INDEX IF NOT EXISTS idx_route_perf_date ON public.route_performance_snapshots(date);

-- Enable RLS
ALTER TABLE public.route_performance_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all route performance snapshots"
  ON public.route_performance_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Drivers can view their own route performance"
  ON public.route_performance_snapshots FOR SELECT
  USING (
    auth.uid() = driver_id OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert route performance snapshots"
  ON public.route_performance_snapshots FOR INSERT
  WITH CHECK (true);

-- Extend stores table
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS last_visit_date DATE,
  ADD COLUMN IF NOT EXISTS last_visit_driver_id UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS visit_frequency_target INTEGER DEFAULT 7,
  ADD COLUMN IF NOT EXISTS visit_risk_level TEXT DEFAULT 'normal' CHECK (visit_risk_level IN ('normal','at_risk','critical'));

-- Extend routes_generated table
ALTER TABLE public.routes_generated
  ADD COLUMN IF NOT EXISTS optimization_score INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS estimated_distance_km NUMERIC;