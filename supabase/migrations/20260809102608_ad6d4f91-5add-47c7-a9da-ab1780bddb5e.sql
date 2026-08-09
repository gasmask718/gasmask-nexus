CREATE OR REPLACE FUNCTION public.compute_funding_dfs(_client_id uuid)
RETURNS TABLE (total integer, completeness integer, breakdown jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  c                 public.funding_clients%ROWTYPE;
  w                 jsonb := '{}'::jsonb;
  parts             jsonb := '{}'::jsonb;
  missing           text[] := ARRAY[]::text[];
  rec               record;
  best_bureau       integer;
  derog_ct          integer;
  inq_12mo          integer;
  util              numeric;
  sub               numeric;
  wt                numeric;
  weighted_sum      numeric := 0;
  weight_used       numeric := 0;
  weight_total      numeric := 0;
  final_score       integer;
  ceiling_amt       numeric;
BEGIN
  SELECT * INTO c FROM public.funding_clients WHERE id = _client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'compute_funding_dfs: client % not found', _client_id;
  END IF;

  FOR rec IN SELECT component, weight FROM public.funding_dfs_weights WHERE is_active LOOP
    w := w || jsonb_build_object(rec.component, rec.weight);
    weight_total := weight_total + rec.weight;
  END LOOP;

  -- personal_credit
  SELECT GREATEST(
           COALESCE(NULLIF(personal_credit_tu,0),0),
           COALESCE(NULLIF(personal_credit_eq,0),0),
           COALESCE(NULLIF(personal_credit_ex,0),0))
    INTO best_bureau
  FROM public.funding_dfs_scores
  WHERE client_id = _client_id
  ORDER BY scored_at DESC LIMIT 1;

  IF COALESCE(best_bureau,0) > 0 THEN
    sub := LEAST(100, GREATEST(0, ((best_bureau - 300)::numeric / 550) * 100));
  ELSE
    sub := NULL;
  END IF;
  wt := COALESCE((w->>'personal_credit')::numeric, 0);
  IF sub IS NULL THEN missing := array_append(missing, 'personal_credit'::text);
  ELSE weighted_sum := weighted_sum + sub*wt; weight_used := weight_used + wt; END IF;
  parts := parts || jsonb_build_object('personal_credit',
    jsonb_build_object('subscore', ROUND(sub,1), 'weight', wt, 'raw', best_bureau));

  -- derogatories
  SELECT count(*) INTO derog_ct
  FROM public.funding_credit_items
  WHERE client_id = _client_id
    AND NOT COALESCE(is_resolved,false)
    AND lower(item_type) <> 'hard inquiry';

  sub := GREATEST(0, 100 - (derog_ct * 8));
  wt := COALESCE((w->>'derogatories')::numeric, 0);
  weighted_sum := weighted_sum + sub*wt; weight_used := weight_used + wt;
  parts := parts || jsonb_build_object('derogatories',
    jsonb_build_object('subscore', ROUND(sub,1), 'weight', wt, 'raw', derog_ct));

  -- utilization
  SELECT CASE WHEN COALESCE(sum(credit_limit),0) > 0
              THEN (sum(COALESCE(current_balance,0)) / sum(credit_limit)) * 100
              ELSE NULL END
    INTO util
  FROM public.funding_credit_items
  WHERE client_id = _client_id AND COALESCE(credit_limit,0) > 0;

  IF util IS NULL THEN sub := NULL;
  ELSIF util <= 10 THEN sub := 100;
  ELSIF util <= 30 THEN sub := 85;
  ELSIF util <= 50 THEN sub := 60;
  ELSIF util <= 75 THEN sub := 35;
  ELSE sub := 10;
  END IF;
  wt := COALESCE((w->>'utilization')::numeric, 0);
  IF sub IS NULL THEN missing := array_append(missing, 'utilization'::text);
  ELSE weighted_sum := weighted_sum + sub*wt; weight_used := weight_used + wt; END IF;
  parts := parts || jsonb_build_object('utilization',
    jsonb_build_object('subscore', ROUND(sub,1), 'weight', wt, 'raw', ROUND(util,1)));

  -- inquiries
  SELECT count(*) INTO inq_12mo
  FROM public.funding_credit_items
  WHERE client_id = _client_id
    AND lower(item_type) = 'hard inquiry'
    AND inquiry_date IS NOT NULL
    AND inquiry_date >= (CURRENT_DATE - INTERVAL '12 months');

  sub := GREATEST(0, 100 - (inq_12mo * 12));
  wt := COALESCE((w->>'inquiries')::numeric, 0);
  weighted_sum := weighted_sum + sub*wt; weight_used := weight_used + wt;
  parts := parts || jsonb_build_object('inquiries',
    jsonb_build_object('subscore', ROUND(sub,1), 'weight', wt, 'raw', inq_12mo));

  -- entity_quality
  sub := 0;
  IF COALESCE(c.business_name,'')  <> '' THEN sub := sub + 25; END IF;
  IF COALESCE(c.ein,'')            <> '' THEN sub := sub + 30; END IF;
  IF COALESCE(c.business_type,'')  <> '' THEN sub := sub + 15; END IF;
  IF COALESCE(c.business_state,'') <> '' THEN sub := sub + 10; END IF;
  IF COALESCE(c.duns_number,'')    <> '' THEN sub := sub + 20; END IF;
  wt := COALESCE((w->>'entity_quality')::numeric, 0);
  weighted_sum := weighted_sum + sub*wt; weight_used := weight_used + wt;
  parts := parts || jsonb_build_object('entity_quality',
    jsonb_build_object('subscore', ROUND(sub,1), 'weight', wt, 'raw', sub));

  -- time_in_business
  IF c.time_in_business_months IS NULL THEN sub := NULL;
  ELSE sub := LEAST(100, (c.time_in_business_months::numeric / 24) * 100);
  END IF;
  wt := COALESCE((w->>'time_in_business')::numeric, 0);
  IF sub IS NULL THEN missing := array_append(missing, 'time_in_business'::text);
  ELSE weighted_sum := weighted_sum + sub*wt; weight_used := weight_used + wt; END IF;
  parts := parts || jsonb_build_object('time_in_business',
    jsonb_build_object('subscore', ROUND(sub,1), 'weight', wt, 'raw', c.time_in_business_months));

  -- revenue
  IF c.monthly_revenue IS NULL THEN sub := NULL;
  ELSE sub := LEAST(100, (c.monthly_revenue / 20000) * 100);
  END IF;
  wt := COALESCE((w->>'revenue')::numeric, 0);
  IF sub IS NULL THEN missing := array_append(missing, 'revenue'::text);
  ELSE weighted_sum := weighted_sum + sub*wt; weight_used := weight_used + wt; END IF;
  parts := parts || jsonb_build_object('revenue',
    jsonb_build_object('subscore', ROUND(sub,1), 'weight', wt, 'raw', c.monthly_revenue));

  IF weight_used = 0 THEN final_score := 0;
  ELSE final_score := ROUND(weighted_sum / weight_used);
  END IF;

  ceiling_amt := ROUND((final_score::numeric / 100) * 150000);
  IF c.monthly_revenue IS NOT NULL AND c.monthly_revenue > 0 THEN
    ceiling_amt := LEAST(ceiling_amt, c.monthly_revenue * 10);
  END IF;

  total        := final_score;
  completeness := CASE WHEN weight_total = 0 THEN 0
                       ELSE ROUND((weight_used / weight_total) * 100) END;
  breakdown    := jsonb_build_object(
                    'components', parts,
                    'missing', to_jsonb(missing),
                    'weight_used', weight_used,
                    'weight_total', weight_total,
                    'funding_ceiling', ceiling_amt);

  IF EXISTS (SELECT 1 FROM public.funding_dfs_scores WHERE client_id = _client_id) THEN
    UPDATE public.funding_dfs_scores s
       SET total_score           = final_score,
           derogatory_count      = derog_ct,
           inquiry_velocity      = inq_12mo,
           utilization_ratio     = COALESCE(ROUND(util)::int, 0),
           entity_quality        = (parts->'entity_quality'->>'subscore')::numeric::int,
           funding_ceiling       = ceiling_amt,
           score_breakdown       = breakdown,
           missing_components    = missing,
           data_completeness_pct = completeness,
           computed_at           = now(),
           computed_by           = 'compute_funding_dfs'
     WHERE s.id = (SELECT id FROM public.funding_dfs_scores
                    WHERE client_id = _client_id ORDER BY scored_at DESC LIMIT 1);
  ELSE
    INSERT INTO public.funding_dfs_scores
      (client_id, total_score, derogatory_count, inquiry_velocity, utilization_ratio,
       entity_quality, funding_ceiling, score_breakdown, missing_components,
       data_completeness_pct, computed_at, computed_by)
    VALUES
      (_client_id, final_score, derog_ct, inq_12mo, COALESCE(ROUND(util)::int,0),
       (parts->'entity_quality'->>'subscore')::numeric::int, ceiling_amt, breakdown, missing,
       completeness, now(), 'compute_funding_dfs');
  END IF;

  UPDATE public.funding_clients
     SET current_dfs_score       = final_score,
         current_funding_ceiling = ceiling_amt,
         updated_at              = now()
   WHERE id = _client_id;

  RETURN NEXT;
END;
$fn$;