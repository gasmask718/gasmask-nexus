
-- Background job queue for SBO analysis
CREATE TABLE public.sbo_analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  job_type TEXT NOT NULL DEFAULT 'full_analysis',
  params JSONB DEFAULT '{}',
  results JSONB DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  progress INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ DEFAULT NULL,
  completed_at TIMESTAMPTZ DEFAULT NULL
);

-- Unified props table merging all sources
CREATE TABLE public.sbo_unified_props (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name TEXT NOT NULL,
  team TEXT,
  stat_type TEXT NOT NULL,
  platform TEXT NOT NULL,
  line NUMERIC NOT NULL,
  over_odds NUMERIC,
  under_odds NUMERIC,
  game_date DATE NOT NULL,
  game_id UUID REFERENCES public.sbo_games(id) ON DELETE SET NULL,
  season_avg NUMERIC,
  l5_avg NUMERIC,
  l10_avg NUMERIC,
  matchup_avg NUMERIC,
  edge_vs_line NUMERIC,
  ai_direction TEXT,
  ai_confidence NUMERIC,
  best_platform BOOLEAN DEFAULT false,
  analysis_job_id UUID REFERENCES public.sbo_analysis_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(player_name, stat_type, platform, game_date)
);

-- RLS
ALTER TABLE public.sbo_analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sbo_unified_props ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read analysis jobs" ON public.sbo_analysis_jobs FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create jobs" ON public.sbo_analysis_jobs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Anyone can read unified props" ON public.sbo_unified_props FOR SELECT USING (true);
CREATE POLICY "Service can insert unified props" ON public.sbo_unified_props FOR INSERT WITH CHECK (true);

-- Enable realtime for job status polling
ALTER PUBLICATION supabase_realtime ADD TABLE public.sbo_analysis_jobs;
