
-- ============================================================
-- T7b Phase 1: schema additions (additive only)
-- ============================================================
ALTER TABLE public.dc_phone_numbers
  ADD COLUMN IF NOT EXISTS risk_score INT NOT NULL DEFAULT 0
    CHECK (risk_score >= 0 AND risk_score <= 100),
  ADD COLUMN IF NOT EXISTS answer_rate NUMERIC(5,4) NULL
    CHECK (answer_rate IS NULL OR (answer_rate >= 0 AND answer_rate <= 1)),
  ADD COLUMN IF NOT EXISTS last_called_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS cooldown_seconds INT NOT NULL DEFAULT 5
    CHECK (cooldown_seconds >= 0),
  ADD COLUMN IF NOT EXISTS daily_call_count INT NOT NULL DEFAULT 0
    CHECK (daily_call_count >= 0),
  ADD COLUMN IF NOT EXISTS daily_call_cap INT NULL
    CHECK (daily_call_cap IS NULL OR daily_call_cap > 0),
  ADD COLUMN IF NOT EXISTS warming_profile TEXT NULL,
  ADD COLUMN IF NOT EXISTS total_calls INT NOT NULL DEFAULT 0
    CHECK (total_calls >= 0),
  ADD COLUMN IF NOT EXISTS total_answered INT NOT NULL DEFAULT 0
    CHECK (total_answered >= 0);

CREATE INDEX IF NOT EXISTS idx_dc_phone_numbers_selection
  ON public.dc_phone_numbers (business, risk_score, answer_rate DESC NULLS LAST)
  WHERE status='active' AND is_active=true;

CREATE INDEX IF NOT EXISTS idx_dc_phone_numbers_last_called
  ON public.dc_phone_numbers (last_called_at)
  WHERE status='active' AND is_active=true;

-- ============================================================
-- Phase 2: warming ramp + updated dial-gate
-- ============================================================
CREATE OR REPLACE FUNCTION public.warming_current_cap(
  p_started_at TIMESTAMPTZ,
  p_profile TEXT
) RETURNS INT
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_started_at IS NULL THEN NULL
    WHEN now() - p_started_at >= interval '14 days' THEN NULL
    WHEN p_profile = 'brandaro_fast' THEN
      CASE
        WHEN now() - p_started_at < interval '3 days' THEN 10
        WHEN now() - p_started_at < interval '7 days' THEN 25
        ELSE 50
      END
    WHEN p_profile = 'dc_slow' THEN
      CASE
        WHEN now() - p_started_at < interval '3 days' THEN 5
        WHEN now() - p_started_at < interval '7 days' THEN 15
        ELSE 40
      END
    ELSE
      CASE
        WHEN now() - p_started_at < interval '3 days' THEN 5
        WHEN now() - p_started_at < interval '7 days' THEN 10
        ELSE 25
      END
  END;
$$;

-- T7a shipped this with param name p_phone_number; must drop to rename.
DROP FUNCTION IF EXISTS public.number_can_dial_now(text);

CREATE OR REPLACE FUNCTION public.number_can_dial_now(p_number text)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    n.status = 'active'
    AND n.is_active = true
    AND n.risk_score < 70
    AND (n.last_called_at IS NULL
         OR now() - n.last_called_at >= (n.cooldown_seconds || ' seconds')::interval)
    AND CASE
      WHEN n.warming_until IS NOT NULL AND n.warming_until > now() THEN
        CASE
          WHEN n.warming_profile IS NULL THEN
            n.daily_call_count < COALESCE(n.warming_daily_cap, 0)
          ELSE
            n.daily_call_count < COALESCE(
              public.warming_current_cap(n.warming_started_at, n.warming_profile),
              n.daily_call_cap,
              999999
            )
        END
      WHEN n.daily_call_cap IS NOT NULL THEN
        n.daily_call_count < n.daily_call_cap
      ELSE
        true
    END
  FROM public.dc_phone_numbers n
  WHERE n.phone_number = p_number;
$$;

-- ============================================================
-- Phase 3: selection function
-- ============================================================
CREATE OR REPLACE FUNCTION public.select_best_number_for_business(
  p_business TEXT
) RETURNS SETOF public.dc_phone_numbers
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
    FROM public.dc_phone_numbers
   WHERE business = p_business
     AND public.number_can_dial_now(phone_number)
   ORDER BY
     risk_score ASC,
     answer_rate DESC NULLS LAST,
     last_called_at ASC NULLS FIRST
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.select_best_number_for_business(TEXT) TO authenticated;

-- ============================================================
-- Phase 4: bump functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.bump_number_usage_v2(p_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.dc_phone_numbers
     SET daily_call_count = daily_call_count + 1,
         total_calls = total_calls + 1,
         last_called_at = now()
   WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bump_number_usage_v2: no row with id %', p_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_number_usage_v2(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.bump_number_answered_v2(p_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.dc_phone_numbers
     SET total_answered = total_answered + 1
   WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'bump_number_answered_v2: no row with id %', p_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_number_answered_v2(UUID) TO authenticated;

-- ============================================================
-- Phase 6: nightly maintenance
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_daily_number_counts_v2()
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.dc_phone_numbers SET daily_call_count = 0;
$$;

CREATE OR REPLACE FUNCTION public.recompute_answer_rates()
RETURNS void
LANGUAGE plpgsql
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
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.dc_phone_numbers
     SET risk_score = GREATEST(risk_score - 2, 0)
   WHERE risk_score > 0;
$$;

-- ============================================================
-- pg_cron schedules (idempotent unschedule then schedule)
-- ============================================================
DO $$
DECLARE
  j RECORD;
BEGIN
  FOR j IN SELECT jobname FROM cron.job
           WHERE jobname IN ('t7b_reset_daily_number_counts',
                             't7b_recompute_answer_rates',
                             't7b_decay_risk_scores')
  LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;
END $$;

SELECT cron.schedule('t7b_reset_daily_number_counts', '5 0 * * *',
  $$SELECT public.reset_daily_number_counts_v2();$$);

SELECT cron.schedule('t7b_recompute_answer_rates', '0 3 * * *',
  $$SELECT public.recompute_answer_rates();$$);

SELECT cron.schedule('t7b_decay_risk_scores', '15 3 * * *',
  $$SELECT public.decay_risk_scores();$$);
