ALTER TABLE public.sbo_capper_picks
  ADD COLUMN IF NOT EXISTS actual_value numeric,
  ADD COLUMN IF NOT EXISTS graded_at timestamptz,
  ADD COLUMN IF NOT EXISTS grading_source text;

COMMENT ON COLUMN public.sbo_capper_picks.actual_value IS 'Box-score value the pick was graded against (sbo-grade-capper-props).';
COMMENT ON COLUMN public.sbo_capper_picks.graded_at IS 'Timestamp of prop grading.';
COMMENT ON COLUMN public.sbo_capper_picks.grading_source IS 'Feed that produced the grade, e.g. espn_box_score.';