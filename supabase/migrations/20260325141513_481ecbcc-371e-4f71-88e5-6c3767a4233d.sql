
-- Sportsbook platforms registry
CREATE TABLE public.sportsbook_platforms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  platform_type TEXT NOT NULL DEFAULT 'sportsbook',
  has_api BOOLEAN DEFAULT false,
  api_source TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sportsbook_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platforms"
ON public.sportsbook_platforms FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage platforms"
ON public.sportsbook_platforms FOR ALL
USING (public.is_admin(auth.uid()) OR public.is_owner(auth.uid()));

-- Seed major platforms
INSERT INTO public.sportsbook_platforms (name, slug, platform_type, has_api, api_source) VALUES
  ('Bovada', 'bovada', 'sportsbook', true, 'betonlineag'),
  ('DraftKings', 'draftkings', 'sportsbook', true, 'draftkings'),
  ('FanDuel', 'fanduel', 'sportsbook', true, 'fanduel'),
  ('BetMGM', 'betmgm', 'sportsbook', true, 'betmgm'),
  ('Caesars', 'caesars', 'sportsbook', true, 'williamhill_us'),
  ('PointsBet', 'pointsbet', 'sportsbook', true, 'pointsbetus'),
  ('PrizePicks', 'prizepicks', 'pickem', false, NULL),
  ('Underdog', 'underdog', 'pickem', false, NULL);

-- Cross-platform line events (API-ingested)
CREATE TABLE public.sportsbook_line_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform_id UUID REFERENCES public.sportsbook_platforms(id) ON DELETE CASCADE,
  platform_slug TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'basketball_nba',
  external_event_id TEXT,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  commence_time TIMESTAMPTZ,
  market_type TEXT NOT NULL,
  player_name TEXT,
  stat_type TEXT,
  line_value NUMERIC,
  over_odds INTEGER,
  under_odds INTEGER,
  home_odds INTEGER,
  away_odds INTEGER,
  draw_odds INTEGER,
  spread_home NUMERIC,
  spread_away NUMERIC,
  spread_home_odds INTEGER,
  spread_away_odds INTEGER,
  total NUMERIC,
  total_over_odds INTEGER,
  total_under_odds INTEGER,
  game_date DATE NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  is_live BOOLEAN DEFAULT false,
  raw_data JSONB
);

ALTER TABLE public.sportsbook_line_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read line events"
ON public.sportsbook_line_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage line events"
ON public.sportsbook_line_events FOR ALL
USING (public.is_admin(auth.uid()) OR public.is_owner(auth.uid()));

CREATE INDEX idx_sle_game_date ON public.sportsbook_line_events(game_date);
CREATE INDEX idx_sle_platform ON public.sportsbook_line_events(platform_slug);
CREATE INDEX idx_sle_sport ON public.sportsbook_line_events(sport);
CREATE INDEX idx_sle_market ON public.sportsbook_line_events(market_type);
CREATE INDEX idx_sle_event ON public.sportsbook_line_events(external_event_id);

-- Cross-platform edge analysis
CREATE TABLE public.sportsbook_edge_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport TEXT NOT NULL,
  game_date DATE NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  market_type TEXT NOT NULL,
  player_name TEXT,
  stat_type TEXT,
  best_platform TEXT,
  best_line NUMERIC,
  worst_platform TEXT,
  worst_line NUMERIC,
  line_spread NUMERIC,
  edge_score INTEGER DEFAULT 0,
  ai_projected_value NUMERIC,
  ai_confidence INTEGER,
  recommendation TEXT DEFAULT 'pass',
  reasoning TEXT,
  platforms_compared JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sportsbook_edge_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read edges"
ON public.sportsbook_edge_analysis FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage edges"
ON public.sportsbook_edge_analysis FOR ALL
USING (public.is_admin(auth.uid()) OR public.is_owner(auth.uid()));

CREATE INDEX idx_sea_game_date ON public.sportsbook_edge_analysis(game_date);
CREATE INDEX idx_sea_edge ON public.sportsbook_edge_analysis(edge_score DESC);
