DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'props_master_dedup_key'
  ) THEN
    ALTER TABLE public.props_master
      ADD CONSTRAINT props_master_dedup_key 
      UNIQUE (player_name, stat_type, line, platform, game_date);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_props_master_game_date ON public.props_master(game_date);
CREATE INDEX IF NOT EXISTS idx_props_master_platform ON public.props_master(platform);
CREATE INDEX IF NOT EXISTS idx_props_master_result ON public.props_master(result);
CREATE INDEX IF NOT EXISTS idx_props_master_confidence ON public.props_master(confidence_score DESC NULLS LAST);