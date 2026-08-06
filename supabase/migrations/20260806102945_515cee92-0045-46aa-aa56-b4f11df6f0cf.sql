CREATE OR REPLACE FUNCTION public.props_master_apply_grades(_grades jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated integer;
BEGIN
  WITH g AS (
    SELECT * FROM jsonb_to_recordset(_grades) AS x(
      player_name text,
      stat_type text,
      line numeric,
      platform text,
      game_date date,
      result text,
      actual_result numeric,
      settled_at timestamptz
    )
  ), upd AS (
    UPDATE public.props_master pm
    SET result = g.result,
        actual_result = COALESCE(g.actual_result, pm.actual_result),
        settled_at = g.settled_at
    FROM g
    WHERE pm.player_name = g.player_name
      AND pm.stat_type = g.stat_type
      AND pm.line = g.line
      AND pm.platform = g.platform
      AND pm.game_date = g.game_date
      AND pm.result = 'pending'
    RETURNING 1
  )
  SELECT count(*)::int INTO _updated FROM upd;
  RETURN _updated;
END;
$$;

REVOKE ALL ON FUNCTION public.props_master_apply_grades(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.props_master_apply_grades(jsonb) TO service_role;