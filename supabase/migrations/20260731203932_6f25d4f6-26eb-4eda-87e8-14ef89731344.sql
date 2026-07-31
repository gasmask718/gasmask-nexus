CREATE TABLE public.sbo_clamp_readiness (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  window_days int NOT NULL DEFAULT 60,
  graded_n int NOT NULL DEFAULT 0,
  wins int NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL DEFAULT 0,
  ci_lower numeric NOT NULL DEFAULT 0,
  coverage_total int NOT NULL DEFAULT 0,
  coverage_full int NOT NULL DEFAULT 0,
  coverage_pct numeric NOT NULL DEFAULT 0,
  hi_bucket_n int NOT NULL DEFAULT 0,
  hi_bucket_rate numeric,
  lo_bucket_n int NOT NULL DEFAULT 0,
  lo_bucket_rate numeric,
  gate_volume boolean NOT NULL DEFAULT false,
  gate_accuracy boolean NOT NULL DEFAULT false,
  gate_ci boolean NOT NULL DEFAULT false,
  gate_coverage boolean NOT NULL DEFAULT false,
  gate_calibration boolean NOT NULL DEFAULT false,
  gates_passed int NOT NULL DEFAULT 0,
  all_gates_pass boolean NOT NULL DEFAULT false,
  blocking_gates text[] NOT NULL DEFAULT '{}',
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sbo_clamp_readiness TO authenticated;
GRANT ALL ON public.sbo_clamp_readiness TO service_role;

ALTER TABLE public.sbo_clamp_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read clamp readiness"
ON public.sbo_clamp_readiness FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_sbo_clamp_readiness_sport_time ON public.sbo_clamp_readiness (sport, evaluated_at DESC);

CREATE OR REPLACE FUNCTION public.sbo_evaluate_clamp_gates(p_sport text, p_days int DEFAULT 60)
RETURNS TABLE (
  n int, wins int, p numeric, ci_low numeric,
  cov_total int, cov_full int,
  hi_n int, hi_rate numeric, lo_n int, lo_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH graded AS (
  SELECT pr.id, pr.final_confidence, pr.was_correct, pr.data_quality
  FROM sbo_predictions pr
  WHERE pr.sport_key = p_sport
    AND pr.created_at >= now() - (p_days || ' days')::interval
    AND pr.prediction_type = 'player_prop'
    AND pr.was_correct IS NOT NULL
    AND coalesce(pr.verdict,'') <> 'push'
),
vol AS (
  SELECT count(*)::int AS n, count(*) FILTER (WHERE was_correct)::int AS wins FROM graded
),
wilson AS (
  SELECT n, wins,
    CASE WHEN n = 0 THEN 0 ELSE wins::numeric / n END AS p,
    CASE WHEN n = 0 THEN 0 ELSE
      (( wins::numeric/n + 1.96^2/(2*n)
         - 1.96 * sqrt( (wins::numeric/n)*(1 - wins::numeric/n)/n + 1.96^2/(4*n^2) ) )
       / (1 + 1.96^2/n))
    END AS ci_low
  FROM vol
),
coverage AS (
  SELECT count(*)::int AS cov_total,
         count(*) FILTER (WHERE data_quality = 'full')::int AS cov_full
  FROM sbo_predictions
  WHERE sport_key = p_sport
    AND prediction_type = 'player_prop'
    AND created_at >= now() - (p_days || ' days')::interval
),
calib AS (
  SELECT
    count(*) FILTER (WHERE final_confidence >= 70)::int AS hi_n,
    avg((was_correct)::int) FILTER (WHERE final_confidence >= 70) AS hi_rate,
    count(*) FILTER (WHERE final_confidence <  70)::int AS lo_n,
    avg((was_correct)::int) FILTER (WHERE final_confidence <  70) AS lo_rate
  FROM graded
)
SELECT w.n, w.wins, w.p, w.ci_low, c.cov_total, c.cov_full, k.hi_n, k.hi_rate, k.lo_n, k.lo_rate
FROM wilson w, coverage c, calib k;
$$;

GRANT EXECUTE ON FUNCTION public.sbo_evaluate_clamp_gates(text, int) TO authenticated, service_role;