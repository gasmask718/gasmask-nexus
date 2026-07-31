ALTER TABLE public.sbo_player_game_stats
  ADD COLUMN player_key text GENERATED ALWAYS AS (coalesce(nullif(player_id, ''), player_name)) STORED;

ALTER TABLE public.sbo_player_season_splits
  ADD COLUMN player_key text GENERATED ALWAYS AS (coalesce(nullif(player_id, ''), player_name)) STORED;

ALTER TABLE public.sbo_player_game_stats DROP CONSTRAINT sbo_player_game_stats_unique;
ALTER TABLE public.sbo_player_game_stats
  ADD CONSTRAINT sbo_player_game_stats_key_unique UNIQUE (sport, player_key, game_id);

ALTER TABLE public.sbo_player_season_splits DROP CONSTRAINT sbo_player_season_splits_unique;
ALTER TABLE public.sbo_player_season_splits
  ADD CONSTRAINT sbo_player_season_splits_key_unique UNIQUE (sport, player_key, season);

CREATE INDEX IF NOT EXISTS idx_sbo_pgs_sport_key_date ON public.sbo_player_game_stats (sport, player_key, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_sbo_pss_sport_key ON public.sbo_player_season_splits (sport, player_key);

CREATE OR REPLACE FUNCTION public.sbo_rebuild_season_splits(_sport text DEFAULT 'mlb'::text, _season text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_season text := coalesce(_season, to_char(now(), 'YYYY'));
  v_count integer;
BEGIN
  WITH g AS (
    SELECT player_key, player_name, player_id, team, game_date, game_id, is_home, stat_line,
           row_number() OVER (PARTITION BY player_key ORDER BY game_date DESC, game_id DESC) AS rn
    FROM public.sbo_player_game_stats
    WHERE sport = _sport
      AND game_date >= (v_season || '-01-01')::date
      AND game_date <= (v_season || '-12-31')::date
  ), kv AS (
    SELECT g.player_key, g.rn, g.is_home, e.key, (e.value #>> '{}')::numeric AS val
    FROM g, LATERAL jsonb_each(g.stat_line) e
    WHERE jsonb_typeof(e.value) = 'number'
  ), per AS (
    SELECT player_key, key,
           round(avg(val), 3) AS all_avg,
           round(avg(val) FILTER (WHERE rn <= 5), 3) AS l5,
           round(avg(val) FILTER (WHERE rn <= 10), 3) AS l10,
           round(avg(val) FILTER (WHERE is_home IS TRUE), 3) AS h,
           round(avg(val) FILTER (WHERE is_home IS FALSE), 3) AS a
    FROM kv GROUP BY 1, 2
  ), obj AS (
    SELECT player_key,
           coalesce(jsonb_object_agg(key, all_avg) FILTER (WHERE all_avg IS NOT NULL), '{}'::jsonb) AS season_averages,
           coalesce(jsonb_object_agg(key, l5)      FILTER (WHERE l5      IS NOT NULL), '{}'::jsonb) AS last_5_averages,
           coalesce(jsonb_object_agg(key, l10)     FILTER (WHERE l10     IS NOT NULL), '{}'::jsonb) AS last_10_averages,
           coalesce(jsonb_object_agg(key, h)       FILTER (WHERE h       IS NOT NULL), '{}'::jsonb) AS home_averages,
           coalesce(jsonb_object_agg(key, a)       FILTER (WHERE a       IS NOT NULL), '{}'::jsonb) AS away_averages
    FROM per GROUP BY 1
  ), meta AS (
    SELECT player_key,
           count(*)::int AS games_played,
           max(game_date) AS last_game_date,
           (array_agg(player_id ORDER BY game_date DESC))[1] AS player_id,
           (array_agg(player_name ORDER BY game_date DESC))[1] AS player_name,
           (array_agg(team ORDER BY game_date DESC))[1] AS team
    FROM g GROUP BY 1
  ), ins AS (
    INSERT INTO public.sbo_player_season_splits AS s (
      sport, player_name, player_id, team, season, games_played,
      season_averages, last_5_averages, last_10_averages,
      home_averages, away_averages, last_game_date, computed_at
    )
    SELECT _sport, m.player_name, m.player_id, m.team, v_season, m.games_played,
           o.season_averages, o.last_5_averages, o.last_10_averages,
           o.home_averages, o.away_averages, m.last_game_date, now()
    FROM meta m JOIN obj o USING (player_key)
    ON CONFLICT (sport, player_key, season) DO UPDATE SET
      player_name = EXCLUDED.player_name,
      player_id = EXCLUDED.player_id,
      team = EXCLUDED.team,
      games_played = EXCLUDED.games_played,
      season_averages = EXCLUDED.season_averages,
      last_5_averages = EXCLUDED.last_5_averages,
      last_10_averages = EXCLUDED.last_10_averages,
      home_averages = EXCLUDED.home_averages,
      away_averages = EXCLUDED.away_averages,
      last_game_date = EXCLUDED.last_game_date,
      computed_at = now()
    RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM ins;

  RETURN v_count;
END;
$function$;