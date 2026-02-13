
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROUTE PROFITABILITY SCORING — Derived Truth Layer
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE public.route_profit_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  worker_type TEXT NOT NULL,
  date DATE NOT NULL,
  territory TEXT,
  stop_count INT NOT NULL DEFAULT 0,
  completed_stops INT NOT NULL DEFAULT 0,
  route_duration_minutes NUMERIC,
  total_revenue NUMERIC NOT NULL DEFAULT 0,
  total_payout NUMERIC NOT NULL DEFAULT 0,
  unpaid_amount NUMERIC NOT NULL DEFAULT 0,
  net_profit NUMERIC NOT NULL DEFAULT 0,
  profit_per_stop NUMERIC,
  profit_per_minute NUMERIC,
  profit_score NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(route_id)
);

ALTER TABLE public.route_profit_metrics ENABLE ROW LEVEL SECURITY;

-- Read-only: any authenticated user in a business can view
CREATE POLICY "profit_metrics_select" ON public.route_profit_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.user_id = auth.uid()
    )
  );

-- Only system (SECURITY DEFINER trigger) can insert — block client inserts
CREATE POLICY "profit_metrics_no_client_insert" ON public.route_profit_metrics
  FOR INSERT WITH CHECK (false);

CREATE INDEX idx_route_profit_metrics_route ON public.route_profit_metrics(route_id);
CREATE INDEX idx_route_profit_metrics_date ON public.route_profit_metrics(date);
CREATE INDEX idx_route_profit_metrics_score ON public.route_profit_metrics(profit_score DESC);
CREATE INDEX idx_route_profit_metrics_worker_type ON public.route_profit_metrics(worker_type);

-- ═══════════════════════════════════════════════════════════════════════════════
-- AUTO-GENERATION FUNCTION — fires after route completion (after payout trigger)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_generate_route_profit_metrics()
RETURNS TRIGGER AS $$
DECLARE
  v_worker_type TEXT;
  v_stop_count INT;
  v_completed_stops INT;
  v_total_payout NUMERIC := 0;
  v_total_revenue NUMERIC := 0;
  v_unpaid NUMERIC := 0;
  v_net_profit NUMERIC;
  v_pps NUMERIC;
  v_ppm NUMERIC;
  v_duration NUMERIC;
  v_completion_ratio NUMERIC;
  v_score NUMERIC;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    IF EXISTS (SELECT 1 FROM public.route_profit_metrics WHERE route_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    v_worker_type := CASE WHEN NEW.type = 'biker' THEN 'biker' ELSE 'driver' END;

    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'completed')
    INTO v_stop_count, v_completed_stops
    FROM public.route_stops WHERE route_id = NEW.id;

    SELECT COALESCE(SUM(total_earned), 0), COALESCE(SUM(total_earned - total_to_pay), 0)
    INTO v_total_payout, v_unpaid
    FROM public.worker_payouts WHERE route_id = NEW.id;

    -- Use actual_duration_minutes from route if available, else approximate
    v_duration := COALESCE(NEW.actual_duration_minutes, v_completed_stops * 12.0);
    v_duration := GREATEST(v_duration, 1);

    -- Revenue approximation (completed stops * base delivery revenue)
    v_total_revenue := v_completed_stops * 15.00;

    v_net_profit := v_total_revenue - v_total_payout - GREATEST(v_unpaid, 0);
    v_pps := CASE WHEN v_completed_stops > 0 THEN v_net_profit / v_completed_stops ELSE 0 END;
    v_ppm := CASE WHEN v_duration > 0 THEN v_net_profit / v_duration ELSE 0 END;
    v_completion_ratio := CASE WHEN v_stop_count > 0 THEN v_completed_stops::NUMERIC / v_stop_count ELSE 0 END;

    -- Normalized 0–100 score: Net Profit 40%, Per Stop 30%, Per Minute 20%, Completion 10%
    v_score := LEAST(100, GREATEST(0,
      (LEAST(v_net_profit / GREATEST(v_total_revenue, 1), 1) * 40) +
      (LEAST(GREATEST(v_pps, 0) / 15.0, 1) * 30) +
      (LEAST(GREATEST(v_ppm, 0) / 2.0, 1) * 20) +
      (v_completion_ratio * 10)
    ));

    INSERT INTO public.route_profit_metrics (
      route_id, worker_type, date, territory,
      stop_count, completed_stops, route_duration_minutes,
      total_revenue, total_payout, unpaid_amount,
      net_profit, profit_per_stop, profit_per_minute, profit_score
    ) VALUES (
      NEW.id, v_worker_type, NEW.date, NEW.territory,
      v_stop_count, v_completed_stops, v_duration,
      v_total_revenue, v_total_payout, GREATEST(v_unpaid, 0),
      v_net_profit, v_pps, v_ppm, v_score
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_auto_generate_route_profit_metrics ON public.routes;
CREATE TRIGGER trg_auto_generate_route_profit_metrics
  AFTER UPDATE ON public.routes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_route_profit_metrics();
