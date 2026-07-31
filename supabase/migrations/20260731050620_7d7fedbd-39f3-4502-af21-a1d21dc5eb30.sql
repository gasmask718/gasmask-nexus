CREATE TABLE public.sbo_player_game_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_id TEXT,
  team TEXT,
  opponent TEXT,
  game_id TEXT NOT NULL,
  game_date DATE NOT NULL,
  is_home BOOLEAN,
  stat_line JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'espn',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sbo_player_game_stats_unique UNIQUE (sport, player_name, game_id)
);

CREATE INDEX idx_sbo_pgs_sport_player_date ON public.sbo_player_game_stats (sport, player_name, game_date DESC);
CREATE INDEX idx_sbo_pgs_sport_date ON public.sbo_player_game_stats (sport, game_date DESC);
CREATE INDEX idx_sbo_pgs_game ON public.sbo_player_game_stats (game_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sbo_player_game_stats TO authenticated;
GRANT ALL ON public.sbo_player_game_stats TO service_role;

ALTER TABLE public.sbo_player_game_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and owners full access"
ON public.sbo_player_game_stats FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE TABLE public.sbo_player_season_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_id TEXT,
  team TEXT,
  season TEXT NOT NULL,
  games_played INTEGER NOT NULL DEFAULT 0,
  season_averages JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_5_averages JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_10_averages JSONB NOT NULL DEFAULT '{}'::jsonb,
  home_averages JSONB NOT NULL DEFAULT '{}'::jsonb,
  away_averages JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_game_date DATE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sbo_player_season_splits_unique UNIQUE (sport, player_name, season)
);

CREATE INDEX idx_sbo_pss_sport_player ON public.sbo_player_season_splits (sport, player_name);
CREATE INDEX idx_sbo_pss_sport_season ON public.sbo_player_season_splits (sport, season);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sbo_player_season_splits TO authenticated;
GRANT ALL ON public.sbo_player_season_splits TO service_role;

ALTER TABLE public.sbo_player_season_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and owners full access"
ON public.sbo_player_season_splits FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_sbo_player_game_stats_updated_at
BEFORE UPDATE ON public.sbo_player_game_stats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sbo_player_season_splits_updated_at
BEFORE UPDATE ON public.sbo_player_season_splits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();