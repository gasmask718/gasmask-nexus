CREATE OR REPLACE FUNCTION public.analyze_store_duplicate_groups_summary()
RETURNS TABLE (
  duplicate_group_id integer,
  normalized_address text,
  group_size integer,
  pristine_shell_count bigint,
  active_record_count bigint,
  proposed_winner_store_id uuid,
  proposed_winner_name text,
  proposed_winner_activity_score bigint,
  group_classification text,
  review_priority text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH a AS (
    SELECT * FROM public.analyze_store_duplicate_groups()
  ),
  per_group AS (
    SELECT
      a.duplicate_group_id,
      MAX(a.normalized_address) AS normalized_address,
      MAX(a.group_size) AS group_size,
      SUM(CASE WHEN a.is_pristine_shell THEN 1 ELSE 0 END) AS pristine_shell_count,
      SUM(CASE WHEN NOT a.is_pristine_shell THEN 1 ELSE 0 END) AS active_record_count,
      (ARRAY_AGG(a.store_id) FILTER (WHERE a.is_winner))[1] AS proposed_winner_store_id,
      (ARRAY_AGG(a.store_name) FILTER (WHERE a.is_winner))[1] AS proposed_winner_name,
      (ARRAY_AGG(a.total_activity_score) FILTER (WHERE a.is_winner))[1] AS proposed_winner_activity_score,
      MAX(a.total_activity_score) AS top_score,
      (ARRAY_AGG(a.total_activity_score ORDER BY a.total_activity_score DESC))[2] AS second_score
    FROM a
    GROUP BY a.duplicate_group_id
  )
  SELECT
    p.duplicate_group_id,
    p.normalized_address,
    p.group_size::int,
    p.pristine_shell_count,
    p.active_record_count,
    p.proposed_winner_store_id,
    p.proposed_winner_name,
    p.proposed_winner_activity_score,
    CASE
      WHEN p.active_record_count = 0 THEN 'all_pristine'
      WHEN p.active_record_count = 1 THEN 'pristine_easy'
      WHEN p.second_score IS NULL OR p.second_score = 0 THEN 'pristine_easy'
      WHEN p.top_score >= p.second_score * 3 THEN 'scattered_clear_winner'
      WHEN p.second_score::numeric / NULLIF(p.top_score,0)::numeric > 0.7 THEN 'scattered_close_call'
      ELSE 'scattered_clear_winner'
    END AS group_classification,
    CASE
      WHEN p.active_record_count >= 2 AND p.second_score::numeric / NULLIF(p.top_score,0)::numeric > 0.7 THEN 'HIGH'
      WHEN p.active_record_count >= 2 THEN 'MEDIUM'
      ELSE 'LOW'
    END AS review_priority
  FROM per_group p
  ORDER BY
    CASE WHEN p.active_record_count >= 2 AND p.second_score::numeric / NULLIF(p.top_score,0)::numeric > 0.7 THEN 0
         WHEN p.active_record_count >= 2 THEN 1 ELSE 2 END,
    p.top_score DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.analyze_store_duplicate_groups_summary() TO authenticated, supabase_read_only_user, service_role, anon;