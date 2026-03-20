
-- Master search memory table
CREATE TABLE IF NOT EXISTS public.brandaro_scout_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  industry TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  searched_at TIMESTAMPTZ DEFAULT NOW(),
  leads_found INTEGER DEFAULT 0,
  leads_imported INTEGER DEFAULT 0,
  success_rate NUMERIC(5,2) DEFAULT 0,
  worth_revisiting BOOLEAN DEFAULT FALSE,
  revisit_after TIMESTAMPTZ,
  notes TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scout_memory_unique
ON public.brandaro_scout_memory(LOWER(industry), LOWER(city), LOWER(state));

ALTER TABLE public.brandaro_scout_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to scout memory" ON public.brandaro_scout_memory FOR ALL USING (true) WITH CHECK (true);

-- Agent config and state
CREATE TABLE IF NOT EXISTS public.brandaro_scout_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  is_active BOOLEAN DEFAULT TRUE,
  mode TEXT DEFAULT 'aggressive',
  searches_per_run INTEGER DEFAULT 10,
  min_hours_between_runs INTEGER DEFAULT 6,
  target_industries JSONB DEFAULT '[]',
  target_states JSONB DEFAULT '[]',
  last_run_at TIMESTAMPTZ,
  total_searches INTEGER DEFAULT 0,
  total_leads_imported INTEGER DEFAULT 0,
  current_focus_state TEXT DEFAULT 'NY',
  current_focus_industry TEXT DEFAULT 'cleaning service',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.brandaro_scout_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to scout config" ON public.brandaro_scout_config FOR ALL USING (true) WITH CHECK (true);

-- Agent run logs
CREATE TABLE IF NOT EXISTS public.brandaro_scout_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  searches_attempted INTEGER DEFAULT 0,
  searches_completed INTEGER DEFAULT 0,
  total_imported INTEGER DEFAULT 0,
  decisions JSONB DEFAULT '[]',
  status TEXT DEFAULT 'running',
  error_message TEXT
);

ALTER TABLE public.brandaro_scout_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to scout runs" ON public.brandaro_scout_runs FOR ALL USING (true) WITH CHECK (true);
