
-- Unique partial index for capper-aware dedup
CREATE UNIQUE INDEX IF NOT EXISTS idx_sbo_capper_picks_dedup 
ON public.sbo_capper_picks (capper_id, player_name, prop_type, line, game_date)
WHERE player_name IS NOT NULL AND prop_type IS NOT NULL AND line IS NOT NULL AND game_date IS NOT NULL;

-- Consensus tracking columns
ALTER TABLE public.sbo_capper_picks 
ADD COLUMN IF NOT EXISTS is_consensus boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS consensus_count integer DEFAULT 0;
