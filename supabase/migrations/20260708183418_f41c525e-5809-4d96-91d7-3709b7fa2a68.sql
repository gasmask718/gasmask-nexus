CREATE OR REPLACE FUNCTION public.recompute_answer_rates()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
       WHERE direction = 'outbound'
         AND created_at >= now() - interval '7 days'
       GROUP BY from_number
    ) subq
   WHERE n.phone_number = subq.from_number;
END;
$function$;