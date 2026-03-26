
-- =============================================
-- PHASE 2: AI SCORING 2.0 + TERRITORY INTELLIGENCE
-- =============================================

-- Territory intelligence materialized as a view
CREATE OR REPLACE VIEW public.ut_territory_intelligence AS
SELECT
  city,
  category,
  count(*) AS total_leads,
  count(*) FILTER (WHERE status = 'onboarded') AS onboarded_count,
  count(*) FILTER (WHERE status IN ('new','callback','follow_up')) AS active_pipeline,
  count(*) FILTER (WHERE status = 'dead') AS dead_count,
  CASE WHEN count(*) > 0
    THEN round((count(*) FILTER (WHERE status = 'onboarded'))::numeric / count(*)::numeric * 100, 1)
    ELSE 0
  END AS conversion_rate,
  round(avg(COALESCE(ai_score, 50))::numeric, 1) AS avg_ai_score,
  max(created_at) AS latest_lead_at
FROM public.ut_partner_leads
WHERE city IS NOT NULL
GROUP BY city, category;

-- Category demand summary
CREATE OR REPLACE VIEW public.ut_category_demand AS
SELECT
  category,
  count(*) AS total_leads,
  count(*) FILTER (WHERE status = 'onboarded') AS supply_count,
  count(*) FILTER (WHERE status IN ('new','callback','follow_up')) AS demand_pipeline,
  CASE
    WHEN count(*) FILTER (WHERE status = 'onboarded') = 0 THEN 'critical'
    WHEN count(*) FILTER (WHERE status = 'onboarded') < 3 THEN 'high'
    WHEN count(*) FILTER (WHERE status = 'onboarded') < 10 THEN 'medium'
    ELSE 'low'
  END AS supply_gap_level,
  CASE WHEN count(*) > 0
    THEN round((count(*) FILTER (WHERE status = 'onboarded'))::numeric / count(*)::numeric * 100, 1)
    ELSE 0
  END AS conversion_rate
FROM public.ut_partner_leads
GROUP BY category
ORDER BY supply_count ASC;

-- City demand summary
CREATE OR REPLACE VIEW public.ut_city_demand AS
SELECT
  city,
  count(*) AS total_leads,
  count(DISTINCT category) AS category_count,
  count(*) FILTER (WHERE status = 'onboarded') AS supply_count,
  count(*) FILTER (WHERE status IN ('new','callback','follow_up')) AS demand_pipeline,
  CASE
    WHEN count(*) FILTER (WHERE status = 'onboarded') = 0 THEN 'critical'
    WHEN count(*) FILTER (WHERE status = 'onboarded') < 5 THEN 'high'
    WHEN count(*) FILTER (WHERE status = 'onboarded') < 15 THEN 'medium'
    ELSE 'low'
  END AS supply_gap_level
FROM public.ut_partner_leads
WHERE city IS NOT NULL
GROUP BY city
ORDER BY supply_count ASC;

-- Dynamic AI Scoring RPC
CREATE OR REPLACE FUNCTION public.ut_calculate_ai_scores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
  lead_row record;
  score numeric;
  reasons jsonb;
  cat_gap text;
  city_gap text;
  cat_conversion numeric;
  city_supply int;
BEGIN
  FOR lead_row IN
    SELECT id, category, city, status, phone, email, contact_name,
           outreach_count, last_outcome, callback_due_at, created_at
    FROM ut_partner_leads
    WHERE status NOT IN ('onboarded', 'dead')
  LOOP
    score := 50;
    reasons := '[]'::jsonb;

    -- 1. Category supply gap (weight: 25)
    SELECT cd.supply_gap_level INTO cat_gap
    FROM ut_category_demand cd WHERE cd.category = lead_row.category;

    IF cat_gap = 'critical' THEN
      score := score + 25;
      reasons := reasons || '["category_critical_gap +25"]'::jsonb;
    ELSIF cat_gap = 'high' THEN
      score := score + 18;
      reasons := reasons || '["category_high_gap +18"]'::jsonb;
    ELSIF cat_gap = 'medium' THEN
      score := score + 10;
      reasons := reasons || '["category_medium_gap +10"]'::jsonb;
    END IF;

    -- 2. City supply gap (weight: 20)
    SELECT cid.supply_gap_level INTO city_gap
    FROM ut_city_demand cid WHERE cid.city = lead_row.city;

    IF city_gap = 'critical' THEN
      score := score + 20;
      reasons := reasons || '["city_critical_gap +20"]'::jsonb;
    ELSIF city_gap = 'high' THEN
      score := score + 14;
      reasons := reasons || '["city_high_gap +14"]'::jsonb;
    ELSIF city_gap = 'medium' THEN
      score := score + 7;
      reasons := reasons || '["city_medium_gap +7"]'::jsonb;
    END IF;

    -- 3. Category conversion history (weight: 15)
    SELECT cd.conversion_rate INTO cat_conversion
    FROM ut_category_demand cd WHERE cd.category = lead_row.category;

    IF cat_conversion IS NOT NULL AND cat_conversion > 20 THEN
      score := score + 15;
      reasons := reasons || '["high_conversion_category +15"]'::jsonb;
    ELSIF cat_conversion IS NOT NULL AND cat_conversion > 10 THEN
      score := score + 8;
      reasons := reasons || '["med_conversion_category +8"]'::jsonb;
    END IF;

    -- 4. Contact completeness (weight: 10)
    IF lead_row.phone IS NOT NULL AND lead_row.email IS NOT NULL AND lead_row.contact_name IS NOT NULL THEN
      score := score + 10;
      reasons := reasons || '["full_contact_info +10"]'::jsonb;
    ELSIF lead_row.phone IS NOT NULL THEN
      score := score + 5;
      reasons := reasons || '["has_phone +5"]'::jsonb;
    END IF;

    -- 5. Callback urgency boost (weight: 10)
    IF lead_row.callback_due_at IS NOT NULL AND lead_row.callback_due_at::timestamptz <= now() + interval '2 hours' THEN
      score := score + 10;
      reasons := reasons || '["callback_urgent +10"]'::jsonb;
    END IF;

    -- 6. Outreach success signals (weight: -10 to +5)
    IF lead_row.last_outcome = 'interested' THEN
      score := score + 5;
      reasons := reasons || '["previously_interested +5"]'::jsonb;
    ELSIF lead_row.outreach_count > 5 AND lead_row.last_outcome IN ('no_answer', 'voicemail') THEN
      score := score - 10;
      reasons := reasons || '["outreach_fatigue -10"]'::jsonb;
    END IF;

    -- 7. Recency bonus (weight: 5)
    IF lead_row.created_at::timestamptz > now() - interval '7 days' THEN
      score := score + 5;
      reasons := reasons || '["fresh_lead +5"]'::jsonb;
    END IF;

    -- Clamp 0-100
    score := GREATEST(0, LEAST(100, score));

    -- Determine priority bucket
    UPDATE ut_partner_leads SET
      ai_score = score::integer,
      ai_score_reasons = reasons,
      priority_bucket = CASE
        WHEN score >= 80 THEN 'hot'
        WHEN score >= 60 THEN 'warm'
        WHEN score >= 40 THEN 'cool'
        ELSE 'cold'
      END
    WHERE id = lead_row.id;

    updated_count := updated_count + 1;
  END LOOP;

  RETURN updated_count;
END;
$$;

-- Territory heatmap RPC
CREATE OR REPLACE FUNCTION public.ut_get_territory_heatmap()
RETURNS TABLE(
  city text,
  category text,
  total_leads bigint,
  onboarded bigint,
  supply_gap text,
  conversion_rate numeric,
  demand_level text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    city,
    category,
    total_leads,
    onboarded_count AS onboarded,
    CASE
      WHEN onboarded_count = 0 THEN 'critical'
      WHEN onboarded_count < 3 THEN 'high'
      WHEN onboarded_count < 10 THEN 'medium'
      ELSE 'low'
    END AS supply_gap,
    conversion_rate,
    CASE
      WHEN active_pipeline > 10 THEN 'high'
      WHEN active_pipeline > 3 THEN 'medium'
      ELSE 'low'
    END AS demand_level
  FROM ut_territory_intelligence
  ORDER BY onboarded_count ASC, total_leads DESC;
$$;
