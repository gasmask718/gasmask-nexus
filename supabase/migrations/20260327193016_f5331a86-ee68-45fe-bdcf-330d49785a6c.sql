
-- Territory Jobs: tracks every individual search job
CREATE TABLE public.ut_territory_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'google_places',
  status TEXT NOT NULL DEFAULT 'queued',
  priority INTEGER NOT NULL DEFAULT 5,
  leads_found INTEGER DEFAULT 0,
  duplicates_skipped INTEGER DEFAULT 0,
  enriched_count INTEGER DEFAULT 0,
  failed_reason TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- State coverage: aggregate state-level tracking
CREATE TABLE public.ut_state_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'not_started',
  priority_tier TEXT NOT NULL DEFAULT 'secondary',
  total_leads INTEGER DEFAULT 0,
  total_onboarded INTEGER DEFAULT 0,
  categories_searched INTEGER DEFAULT 0,
  cities_covered INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ut_territory_jobs_state ON public.ut_territory_jobs(state);
CREATE INDEX idx_ut_territory_jobs_status ON public.ut_territory_jobs(status);
CREATE INDEX idx_ut_territory_jobs_category ON public.ut_territory_jobs(category);
CREATE INDEX idx_ut_state_coverage_status ON public.ut_state_coverage(status);

-- RLS
ALTER TABLE public.ut_territory_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ut_state_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage territory jobs" ON public.ut_territory_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage state coverage" ON public.ut_state_coverage FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed all 50 states
INSERT INTO public.ut_state_coverage (state, priority_tier) VALUES
  ('Alabama', 'secondary'), ('Alaska', 'hold'), ('Arizona', 'secondary'), ('Arkansas', 'hold'),
  ('California', 'priority'), ('Colorado', 'secondary'), ('Connecticut', 'secondary'), ('Delaware', 'hold'),
  ('Florida', 'priority'), ('Georgia', 'priority'), ('Hawaii', 'hold'), ('Idaho', 'hold'),
  ('Illinois', 'priority'), ('Indiana', 'secondary'), ('Iowa', 'hold'), ('Kansas', 'hold'),
  ('Kentucky', 'secondary'), ('Louisiana', 'secondary'), ('Maine', 'hold'), ('Maryland', 'secondary'),
  ('Massachusetts', 'secondary'), ('Michigan', 'secondary'), ('Minnesota', 'secondary'), ('Mississippi', 'hold'),
  ('Missouri', 'secondary'), ('Montana', 'hold'), ('Nebraska', 'hold'), ('Nevada', 'secondary'),
  ('New Hampshire', 'hold'), ('New Jersey', 'priority'), ('New Mexico', 'hold'), ('New York', 'priority'),
  ('North Carolina', 'secondary'), ('North Dakota', 'hold'), ('Ohio', 'secondary'), ('Oklahoma', 'hold'),
  ('Oregon', 'secondary'), ('Pennsylvania', 'priority'), ('Rhode Island', 'hold'), ('South Carolina', 'secondary'),
  ('South Dakota', 'hold'), ('Tennessee', 'secondary'), ('Texas', 'priority'), ('Utah', 'hold'),
  ('Vermont', 'hold'), ('Virginia', 'secondary'), ('Washington', 'secondary'), ('West Virginia', 'hold'),
  ('Wisconsin', 'secondary'), ('Wyoming', 'hold');
