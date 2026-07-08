
CREATE OR REPLACE FUNCTION public.reset_daily_number_counts_v2()
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.dc_phone_numbers SET daily_call_count = 0;
$$;

CREATE OR REPLACE FUNCTION public.recompute_answer_rates()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.dc_phone_numbers n
     SET answer_rate = subq.rate
    FROM (
      SELECT from_number,
             count(*) FILTER (
               WHERE (status IN ('answered','completed') AND duration_seconds > 0)
                  OR answered_by = 'human'
             )::numeric
               / NULLIF(count(*), 0) AS rate
        FROM public.dc_call_logs
       WHERE created_at >= now() - interval '7 days'
       GROUP BY from_number
    ) subq
   WHERE n.phone_number = subq.from_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.decay_risk_scores()
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.dc_phone_numbers
     SET risk_score = GREATEST(risk_score - 2, 0)
   WHERE risk_score > 0;
$$;
