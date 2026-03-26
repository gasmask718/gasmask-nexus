
-- MASTER PROPS TABLE: Single source of truth for ALL prop data
CREATE TABLE public.props_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core identity
  player_name TEXT NOT NULL,
  team TEXT,
  opponent TEXT,
  sport TEXT DEFAULT 'NBA',
  stat_type TEXT NOT NULL,
  line NUMERIC(6,2) NOT NULL,
  platform TEXT NOT NULL DEFAULT 'manual',
  odds TEXT,
  game_time TIMESTAMPTZ,
  game_date TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  
  -- AI Intelligence
  prediction TEXT,
  confidence_score NUMERIC(5,2),
  edge_score NUMERIC(5,2),
  reasoning_json JSONB DEFAULT '{}'::jsonb,
  
  -- Stats enrichment
  season_avg NUMERIC(6,2),
  last_5_avg NUMERIC(6,2),
  last_10_avg NUMERIC(6,2),
  hit_rate NUMERIC(5,2),
  matchup_avg NUMERIC(6,2),
  
  -- Results tracking
  actual_result NUMERIC(6,2),
  result TEXT DEFAULT 'pending',
  settled_at TIMESTAMPTZ,
  
  -- Grouping / provenance
  batch_id TEXT,
  upload_group_id UUID,
  original_image_url TEXT,
  
  -- Meta
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.props_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage props_master"
  ON public.props_master FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes for fast queries
CREATE INDEX idx_props_master_game_date ON public.props_master(game_date);
CREATE INDEX idx_props_master_platform ON public.props_master(platform);
CREATE INDEX idx_props_master_player ON public.props_master(player_name);
CREATE INDEX idx_props_master_result ON public.props_master(result);
CREATE INDEX idx_props_master_confidence ON public.props_master(confidence_score DESC NULLS LAST);
CREATE INDEX idx_props_master_upload_group ON public.props_master(upload_group_id);

-- Unique constraint to prevent duplicates
CREATE UNIQUE INDEX idx_props_master_unique_prop 
  ON public.props_master(player_name, stat_type, game_date, platform)
  WHERE game_date IS NOT NULL;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.props_master;
