ALTER TABLE public.props_master
ADD COLUMN IF NOT EXISTS player_prop_id UUID
REFERENCES public.sbo_player_props(id) ON DELETE SET NULL;

UPDATE props_master pm
SET player_prop_id = pp.id
FROM (
  SELECT DISTINCT ON (player_name, prop_type, game_date::date, line)
    id, player_name, prop_type, game_date, line
  FROM sbo_player_props
  ORDER BY player_name, prop_type, game_date::date, line, updated_at DESC
) pp
WHERE pp.player_name = pm.player_name
  AND pp.prop_type = pm.stat_type
  AND pp.game_date::date = pm.game_date::date
  AND pp.line = pm.line
  AND pm.player_prop_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_props_master_player_prop_id
ON public.props_master(player_prop_id);