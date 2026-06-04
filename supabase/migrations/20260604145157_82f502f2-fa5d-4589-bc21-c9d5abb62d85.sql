
CREATE OR REPLACE FUNCTION public.cm_stamp_store_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phone text; v_store_id uuid;
BEGIN
  IF NEW.store_id IS NOT NULL THEN RETURN NEW; END IF;
  v_phone := COALESCE(NEW.to_number, NEW.from_number, NEW.phone_number);
  IF v_phone IS NULL THEN RETURN NEW; END IF;
  v_phone := regexp_replace(v_phone, '[^0-9]', '', 'g');
  IF length(v_phone) < 10 THEN RETURN NEW; END IF;
  v_phone := right(v_phone, 10);
  SELECT id INTO v_store_id FROM public.store_master
  WHERE right(regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g'), 10) = v_phone
  LIMIT 1;
  IF v_store_id IS NOT NULL THEN NEW.store_id := v_store_id; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_cm_stamp_store_id ON public.communication_messages;
CREATE TRIGGER trg_cm_stamp_store_id
BEFORE INSERT OR UPDATE OF to_number, from_number, phone_number
ON public.communication_messages
FOR EACH ROW EXECUTE FUNCTION public.cm_stamp_store_id();

UPDATE public.communication_messages cm
SET store_id = sm.id
FROM public.store_master sm
WHERE cm.store_id IS NULL
  AND length(regexp_replace(coalesce(cm.to_number, cm.from_number, cm.phone_number, ''), '[^0-9]', '', 'g')) >= 10
  AND right(regexp_replace(coalesce(cm.to_number, cm.from_number, cm.phone_number, ''), '[^0-9]', '', 'g'), 10)
    = right(regexp_replace(coalesce(sm.phone,''), '[^0-9]', '', 'g'), 10);

CREATE TABLE IF NOT EXISTS public.ai_worker_performance_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  metric_date date NOT NULL DEFAULT CURRENT_DATE,
  tasks_completed integer NOT NULL DEFAULT 0,
  tasks_failed integer NOT NULL DEFAULT 0,
  avg_duration_seconds numeric,
  total_seconds numeric,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, metric_date)
);
GRANT SELECT ON public.ai_worker_performance_daily TO authenticated;
GRANT ALL ON public.ai_worker_performance_daily TO service_role;
ALTER TABLE public.ai_worker_performance_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AI worker perf readable" ON public.ai_worker_performance_daily;
CREATE POLICY "AI worker perf readable"
  ON public.ai_worker_performance_daily FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.ai_worker_performance_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows int := 0;
BEGIN
  WITH agg AS (
    SELECT
      assigned_to_worker_id AS worker_id,
      date_trunc('day', completed_at)::date AS metric_date,
      count(*) FILTER (WHERE status='completed')::int AS done,
      count(*) FILTER (WHERE status='failed')::int AS failed,
      avg(extract(epoch FROM (completed_at - created_at))) AS avg_sec,
      sum(extract(epoch FROM (completed_at - created_at))) AS total_sec
    FROM public.ai_work_tasks
    WHERE assigned_to_worker_id IS NOT NULL
      AND completed_at >= now() - interval '7 days'
    GROUP BY 1,2
  )
  INSERT INTO public.ai_worker_performance_daily
    (worker_id, metric_date, tasks_completed, tasks_failed, avg_duration_seconds, total_seconds)
  SELECT worker_id, metric_date, done, failed, avg_sec, total_sec FROM agg
  WHERE worker_id IS NOT NULL AND metric_date IS NOT NULL
  ON CONFLICT (worker_id, metric_date) DO UPDATE
    SET tasks_completed = EXCLUDED.tasks_completed,
        tasks_failed = EXCLUDED.tasks_failed,
        avg_duration_seconds = EXCLUDED.avg_duration_seconds,
        total_seconds = EXCLUDED.total_seconds,
        computed_at = now();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('upserted', v_rows, 'at', now());
END; $$;

CREATE OR REPLACE FUNCTION public.expansion_scores_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int := 0;
BEGIN
  INSERT INTO public.expansion_scores
    (location_type, location_name, state, score, expected_roi, priority, driver_capacity_needed, reasoning, recommendations)
  SELECT 'city', city, state,
    coalesce(market_score, 0), NULL,
    coalesce(expansion_priority, 0),
    GREATEST(1, coalesce(population,0)/50000),
    'Auto-scored from expansion_cities snapshot',
    jsonb_build_object('source','expansion_cities','migration_trend',migration_trend)
  FROM public.expansion_cities ec
  WHERE NOT EXISTS (
    SELECT 1 FROM public.expansion_scores es
    WHERE es.location_name = ec.city AND es.state = ec.state
      AND es.created_at > now() - interval '1 day'
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('inserted', v_count);
END; $$;

INSERT INTO public.pricing_tiers (product_id, tier, min_qty, price_per_unit)
SELECT pa.id, t.tier, t.min_qty,
  CASE t.tier
    WHEN 'retail'    THEN COALESCE(pa.retail_price,   pa.wholesale_price, 0)
    WHEN 'store'     THEN COALESCE(pa.store_price,    pa.wholesale_price, 0)
    WHEN 'wholesale' THEN COALESCE(pa.wholesale_price, 0)
  END
FROM public.products_all pa
CROSS JOIN (VALUES ('retail',1),('store',10),('wholesale',50)) AS t(tier, min_qty)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_tiers pt WHERE pt.product_id = pa.id AND pt.tier = t.tier
);

INSERT INTO public.inventory_stock (product_id, owner_type, owner_id, quantity_on_hand, quantity_reserved)
SELECT i.product_id, 'location', i.location_id, coalesce(sum(i.quantity), 0)::int, 0
FROM public.inventory i
WHERE i.product_id IS NOT NULL
GROUP BY i.product_id, i.location_id
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.ambassador_commissions IS 'DEPRECATED 2026-06-04 — use commission_ledger. Reader rewrite pending (11 hooks + ambassador-profile edge fn). Do not write.';
COMMENT ON TABLE public.commission_events IS 'DEPRECATED 2026-06-04 — use commission_ledger. Reader rewrite pending. Do not write.';

INSERT INTO public.health_checks (check_key, kind, business, floor, label, cadence_expected_minutes, config, enabled)
VALUES
  ('producer.ai_worker_performance_tick', 'cron', 'core', 'F9', 'AI worker performance writer', 60, '{"function":"ai_worker_performance_tick"}'::jsonb, true),
  ('producer.expansion_scores_tick', 'cron', 'core', 'F8', 'Expansion scores writer', 720, '{"function":"expansion_scores_tick"}'::jsonb, true),
  ('trigger.cm_stamp_store_id', 'trigger', 'core', 'F2', 'communication_messages store_id auto-stamp', 1440, '{"trigger":"trg_cm_stamp_store_id"}'::jsonb, true)
ON CONFLICT (check_key) DO UPDATE SET enabled=true, updated_at=now();

DO $$ BEGIN PERFORM cron.unschedule('ai_worker_performance_tick_hourly'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('ai_worker_performance_tick_hourly', '5 * * * *', $$ SELECT public.ai_worker_performance_tick(); $$);

DO $$ BEGIN PERFORM cron.unschedule('expansion_scores_tick_daily'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('expansion_scores_tick_daily', '15 6 * * *', $$ SELECT public.expansion_scores_tick(); $$);

SELECT public.ai_worker_performance_tick();
SELECT public.expansion_scores_tick();
SELECT public.engagement_scores_tick();

UPDATE public.floor_directory SET status='ready', last_audited=now()
WHERE page_route IN ('/analytics/rep-performance','/va/performance','/expansion');
