-- ============================================================
-- DFS (Dynasty Fundability Score) auto-scoring engine
-- ============================================================

-- 1. Configurable weights (owner-tunable, no dev required)
CREATE TABLE public.funding_dfs_weights (
  component      text PRIMARY KEY,
  weight         numeric NOT NULL CHECK (weight >= 0),
  label          text NOT NULL,
  description    text,
  is_active      boolean NOT NULL DEFAULT true,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.funding_dfs_weights TO authenticated;
GRANT ALL ON public.funding_dfs_weights TO service_role;
ALTER TABLE public.funding_dfs_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY funding_dfs_weights_staff_read ON public.funding_dfs_weights
  FOR SELECT TO authenticated USING (public.is_funding_staff(auth.uid()));
CREATE POLICY funding_dfs_weights_service_all ON public.funding_dfs_weights
  TO service_role USING (true) WITH CHECK (true);

INSERT INTO public.funding_dfs_weights (component, weight, label, description) VALUES
  ('personal_credit',  30, 'Personal credit',    'Highest available bureau score (TU/EQ/EX)'),
  ('derogatories',     20, 'Derogatory items',   'Unresolved charge-offs, collections and late payments'),
  ('utilization',      10, 'Credit utilization', 'Revolving balance vs limit across tradelines'),
  ('inquiries',        10, 'Inquiry velocity',   'Hard inquiries in the trailing 12 months'),
  ('entity_quality',   10, 'Entity quality',     'LLC/EIN/DUNS/registered address completeness'),
  ('time_in_business', 10, 'Time in business',   'Months of verifiable operating history'),
  ('revenue',          10, 'Revenue',            'Monthly revenue on file');

-- 2. Breakdown + provenance columns on the score record
ALTER TABLE public.funding_dfs_scores
  ADD COLUMN IF NOT EXISTS score_breakdown       jsonb,
  ADD COLUMN IF NOT EXISTS missing_components    text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS data_completeness_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS computed_at           timestamptz,
  ADD COLUMN IF NOT EXISTS computed_by           text;

-- 3. The calculator
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
  missing           text[] := '{}';
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

  -- helper inline: record a component
  -- (sub NULL => missing, excluded from the average rather than scored 0)

  ---------------------------------------------------------------
  -- personal_credit : best available bureau score, 300-850 -> 0-100
  ---------------------------------------------------------------
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
  IF sub IS NULL THEN missing := missing || 'personal_credit';
  ELSE weighted_sum := weighted_sum + sub*wt; weight_used := weight_used + wt; END IF;
  parts := parts || jsonb_build_object('personal_credit',
    jsonb_build_object('subscore', ROUND(sub,1), 'weight', wt, 'raw', best_bureau));

  ---------------------------------------------------------------
  -- derogatories : unresolved charge-offs / collections / lates
  ---------------------------------------------------------------
  SELECT count(*) INTO derog_ct
  FROM public.funding_credit_items
  WHERE client_id = _client_id
    AND NOT COALESCE(is_resolved,false)
    AND lower(item_type) <> 'hard inquiry';

  -- 0 items = 100; each derogatory costs 8 pts, floor 0
  sub := GREATEST(0, 100 - (derog_ct * 8));
  wt := COALESCE((w->>'derogatories')::numeric, 0);
  weighted_sum := weighted_sum + sub*wt; weight_used := weight_used + wt;
  parts := parts || jsonb_build_object('derogatories',
    jsonb_build_object('subscore', ROUND(sub,1), 'weight', wt, 'raw', derog_ct));

  ---------------------------------------------------------------
  -- utilization : only when limits/balances actually exist
  ---------------------------------------------------------------
  SELECT CASE WHEN COALESCE(sum(credit_limit),0) > 0
              THEN (sum(COALESCE(current_balance,0)) / sum(credit_limit)) * 100
              ELSE NULL END
    INTO util
  FROM public.funding_credit_items
  WHERE client_id = _client_id AND COALESCE(credit_limit,0) > 0;

  IF util IS NULL THEN
    sub := NULL;
  ELSIF util <= 10 THEN sub := 100;
  ELSIF util <= 30 THEN sub := 85;
  ELSIF util <= 50 THEN sub := 60;
  ELSIF util <= 75 THEN sub := 35;
  ELSE sub := 10;
  END IF;
  wt := COALESCE((w->>'utilization')::numeric, 0);
  IF sub IS NULL THEN missing := missing || 'utilization';
  ELSE weighted_sum := weighted_sum + sub*wt; weight_used := weight_used + wt; END IF;
  parts := parts || jsonb_build_object('utilization',
    jsonb_build_object('subscore', ROUND(sub,1), 'weight', wt, 'raw', ROUND(util,1)));

  ---------------------------------------------------------------
  -- inquiries : hard inquiries in trailing 12 months
  ---------------------------------------------------------------
  SELECT count(*) INTO inq_12mo
  FROM public.funding_credit_items
  WHERE client_id = _client_id
    AND lower(item_type) = 'hard inquiry'
    AND inquiry_date IS NOT NULL
    AND inquiry_date >= (CURRENT_DATE - INTERVAL '12 months');

  sub := GREATEST(0, 100 - (inq_12mo * 12));   -- ~8 inquiries -> 0
  wt := COALESCE((w->>'inquiries')::numeric, 0);
  weighted_sum := weighted_sum + sub*wt; weight_used := weight_used + wt;
  parts := parts || jsonb_build_object('inquiries',
    jsonb_build_object('subscore', ROUND(sub,1), 'weight', wt, 'raw', inq_12mo));

  ---------------------------------------------------------------
  -- entity_quality : structural completeness
  ---------------------------------------------------------------
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

  ---------------------------------------------------------------
  -- time_in_business : 24+ months = full marks
  ---------------------------------------------------------------
  IF c.time_in_business_months IS NULL THEN
    sub := NULL;
  ELSE
    sub := LEAST(100, (c.time_in_business_months::numeric / 24) * 100);
  END IF;
  wt := COALESCE((w->>'time_in_business')::numeric, 0);
  IF sub IS NULL THEN missing := missing || 'time_in_business';
  ELSE weighted_sum := weighted_sum + sub*wt; weight_used := weight_used + wt; END IF;
  parts := parts || jsonb_build_object('time_in_business',
    jsonb_build_object('subscore', ROUND(sub,1), 'weight', wt, 'raw', c.time_in_business_months));

  ---------------------------------------------------------------
  -- revenue : $20k/mo = full marks
  ---------------------------------------------------------------
  IF c.monthly_revenue IS NULL THEN
    sub := NULL;
  ELSE
    sub := LEAST(100, (c.monthly_revenue / 20000) * 100);
  END IF;
  wt := COALESCE((w->>'revenue')::numeric, 0);
  IF sub IS NULL THEN missing := missing || 'revenue';
  ELSE weighted_sum := weighted_sum + sub*wt; weight_used := weight_used + wt; END IF;
  parts := parts || jsonb_build_object('revenue',
    jsonb_build_object('subscore', ROUND(sub,1), 'weight', wt, 'raw', c.monthly_revenue));

  ---------------------------------------------------------------
  -- Normalise over AVAILABLE weight only
  ---------------------------------------------------------------
  IF weight_used = 0 THEN
    final_score := 0;
  ELSE
    final_score := ROUND(weighted_sum / weight_used);
  END IF;

  -- Conservative funding ceiling: score-scaled, revenue-capped
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

  -- Persist onto the latest score row (or create one)
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

  -- Keep the denormalised client fields in sync
  UPDATE public.funding_clients
     SET current_dfs_score       = final_score,
         current_funding_ceiling = ceiling_amt,
         updated_at              = now()
   WHERE id = _client_id;

  RETURN NEXT;
END;
$fn$;

REVOKE ALL ON FUNCTION public.compute_funding_dfs(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_funding_dfs(uuid) TO authenticated, service_role;

-- 4. Recompute automatically when inputs change
CREATE OR REPLACE FUNCTION public.trg_recompute_funding_dfs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $t$
DECLARE
  target uuid := COALESCE(NEW.client_id, OLD.client_id);
BEGIN
  IF target IS NOT NULL THEN
    PERFORM public.compute_funding_dfs(target);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$t$;

CREATE TRIGGER funding_credit_items_dfs_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.funding_credit_items
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_funding_dfs();

CREATE OR REPLACE FUNCTION public.trg_recompute_funding_dfs_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $t$
BEGIN
  PERFORM public.compute_funding_dfs(NEW.id);
  RETURN NEW;
END;
$t$;

CREATE TRIGGER funding_clients_dfs_recompute
AFTER UPDATE OF business_name, ein, business_type, business_state, duns_number,
                time_in_business_months, monthly_revenue
ON public.funding_clients
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_funding_dfs_client();