
-- Phase I: Create missing dialer_daily_metrics table and momentum view

CREATE TABLE IF NOT EXISTS public.dialer_daily_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  metric_date date NOT NULL DEFAULT CURRENT_DATE,
  total_dials integer DEFAULT 0,
  total_connects integer DEFAULT 0,
  total_revenue numeric DEFAULT 0,
  total_cost numeric DEFAULT 0,
  net_profit numeric DEFAULT 0,
  new_dnc_count integer DEFAULT 0,
  avg_answer_rate numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(business_id, metric_date)
);

ALTER TABLE public.dialer_daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage dialer_daily_metrics" ON public.dialer_daily_metrics FOR ALL USING (true) WITH CHECK (true);

-- Now create the momentum view
CREATE OR REPLACE VIEW public.v_revenue_momentum AS
SELECT
  business_id,
  SUM(CASE WHEN metric_date >= CURRENT_DATE - 7 THEN total_revenue ELSE 0 END) AS last_7d_revenue,
  SUM(CASE WHEN metric_date >= CURRENT_DATE - 14 AND metric_date < CURRENT_DATE - 7 THEN total_revenue ELSE 0 END) AS prev_7d_revenue,
  CASE 
    WHEN SUM(CASE WHEN metric_date >= CURRENT_DATE - 14 AND metric_date < CURRENT_DATE - 7 THEN total_revenue ELSE 0 END) > 0
    THEN (
      SUM(CASE WHEN metric_date >= CURRENT_DATE - 7 THEN total_revenue ELSE 0 END) 
      - SUM(CASE WHEN metric_date >= CURRENT_DATE - 14 AND metric_date < CURRENT_DATE - 7 THEN total_revenue ELSE 0 END)
    ) / SUM(CASE WHEN metric_date >= CURRENT_DATE - 14 AND metric_date < CURRENT_DATE - 7 THEN total_revenue ELSE 0 END)
    ELSE 0
  END AS momentum_pct,
  SUM(CASE WHEN metric_date >= CURRENT_DATE - 7 THEN net_profit ELSE 0 END) AS last_7d_profit,
  SUM(CASE WHEN metric_date >= CURRENT_DATE - 14 AND metric_date < CURRENT_DATE - 7 THEN net_profit ELSE 0 END) AS prev_7d_profit
FROM public.dialer_daily_metrics
GROUP BY business_id;
