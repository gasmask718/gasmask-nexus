
CREATE TABLE IF NOT EXISTS public.dd_supplier_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id uuid NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  orders_received int DEFAULT 0,
  orders_fulfilled int DEFAULT 0,
  orders_late int DEFAULT 0,
  orders_cancelled int DEFAULT 0,
  avg_fulfillment_hours numeric,
  on_time_rate numeric,
  fulfillment_rate numeric,
  issue_count int DEFAULT 0,
  revenue_generated numeric DEFAULT 0,
  calculated_at timestamptz DEFAULT now(),
  UNIQUE(wholesaler_id, period_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_supplier_metrics TO authenticated;
GRANT ALL ON public.dd_supplier_metrics TO service_role;

ALTER TABLE public.dd_supplier_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access" ON public.dd_supplier_metrics;
CREATE POLICY "Admin full access"
  ON public.dd_supplier_metrics
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.wholesalers
  ADD COLUMN IF NOT EXISTS overall_rating numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_orders_fulfilled int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_fulfillment_days numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS on_time_rate_lifetime numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_order_at timestamptz,
  ADD COLUMN IF NOT EXISTS preferred bool DEFAULT false,
  ADD COLUMN IF NOT EXISTS reliability_grade text DEFAULT 'unrated',
  ADD COLUMN IF NOT EXISTS review_notes text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='wholesalers_overall_rating_chk') THEN
    ALTER TABLE public.wholesalers ADD CONSTRAINT wholesalers_overall_rating_chk CHECK (overall_rating BETWEEN 0 AND 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='wholesalers_reliability_grade_chk') THEN
    ALTER TABLE public.wholesalers ADD CONSTRAINT wholesalers_reliability_grade_chk CHECK (reliability_grade IN ('unrated','A','B','C','D','F'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.dd_calculate_supplier_metrics(
  p_wholesaler_id uuid,
  p_days int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orders_received int;
  v_orders_fulfilled int;
  v_revenue numeric;
  v_period_start date := (now() - (p_days || ' days')::interval)::date;
  v_period_end date := now()::date;
  v_fulfillment_rate numeric;
BEGIN
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE dgo.status = 'fulfilled')::int,
    COALESCE(SUM(mo.total), 0)
  INTO v_orders_received, v_orders_fulfilled, v_revenue
  FROM dd_grabba_sync dgo
  LEFT JOIN marketplace_orders mo ON mo.id = dgo.marketplace_order_id
  WHERE dgo.wholesaler_id = p_wholesaler_id
    AND dgo.created_at >= now() - (p_days || ' days')::interval;

  v_fulfillment_rate := CASE WHEN v_orders_received > 0
    THEN ROUND(v_orders_fulfilled::numeric / v_orders_received * 100, 1)
    ELSE 0 END;

  INSERT INTO dd_supplier_metrics (
    wholesaler_id, period_start, period_end,
    orders_received, orders_fulfilled, fulfillment_rate, revenue_generated, calculated_at
  ) VALUES (
    p_wholesaler_id, v_period_start, v_period_end,
    v_orders_received, v_orders_fulfilled, v_fulfillment_rate, v_revenue, now()
  )
  ON CONFLICT (wholesaler_id, period_start) DO UPDATE
    SET period_end = EXCLUDED.period_end,
        orders_received = EXCLUDED.orders_received,
        orders_fulfilled = EXCLUDED.orders_fulfilled,
        fulfillment_rate = EXCLUDED.fulfillment_rate,
        revenue_generated = EXCLUDED.revenue_generated,
        calculated_at = now();

  UPDATE wholesalers
  SET total_orders_fulfilled = v_orders_fulfilled,
      on_time_rate_lifetime = v_fulfillment_rate,
      reliability_grade = CASE
        WHEN v_orders_received = 0 THEN 'unrated'
        WHEN v_fulfillment_rate >= 95 THEN 'A'
        WHEN v_fulfillment_rate >= 85 THEN 'B'
        WHEN v_fulfillment_rate >= 70 THEN 'C'
        WHEN v_fulfillment_rate >= 50 THEN 'D'
        ELSE 'F'
      END,
      last_order_at = (SELECT MAX(created_at) FROM dd_grabba_sync WHERE wholesaler_id = p_wholesaler_id)
  WHERE id = p_wholesaler_id;

  RETURN jsonb_build_object(
    'orders_received', v_orders_received,
    'orders_fulfilled', v_orders_fulfilled,
    'revenue', v_revenue,
    'fulfillment_rate', v_fulfillment_rate
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dd_calculate_supplier_metrics(uuid, int) TO authenticated;
