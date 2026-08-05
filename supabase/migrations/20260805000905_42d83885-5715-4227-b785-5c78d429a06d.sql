UPDATE public.sbo_cappers
SET win_rate  = ROUND((win_rate * 100)::numeric, 2),
    updated_at = now()
WHERE win_rate > 0
  AND win_rate < 1;