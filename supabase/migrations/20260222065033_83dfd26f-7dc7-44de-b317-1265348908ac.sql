
-- Phase 7: Marketplace Admin Control Tower (fixed)

-- 1. Admin action log for marketplace oversight
CREATE TABLE public.marketplace_admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action_type text NOT NULL,
  related_order_id uuid REFERENCES public.marketplace_orders(id),
  related_vendor_id uuid,
  previous_state jsonb,
  new_state jsonb,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketplace_admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view marketplace admin actions"
  ON public.marketplace_admin_actions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert marketplace admin actions"
  ON public.marketplace_admin_actions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_marketplace_admin_actions_order ON public.marketplace_admin_actions(related_order_id);
CREATE INDEX idx_marketplace_admin_actions_vendor ON public.marketplace_admin_actions(related_vendor_id);
CREATE INDEX idx_marketplace_admin_actions_created ON public.marketplace_admin_actions(created_at DESC);

-- 2. Vendor performance summary materialized view
CREATE MATERIALIZED VIEW public.vendor_performance_summary AS
SELECT
  w.id AS vendor_id,
  COALESCE(w.contact_name, w.name, w.id::text) AS vendor_name,
  COALESCE(SUM(CASE WHEN mo.created_at >= now() - interval '30 days' THEN mo.total ELSE 0 END), 0) AS total_gmv_30d,
  COALESCE(
    AVG(
      CASE WHEN mf.status IN ('shipped', 'completed') 
        THEN EXTRACT(EPOCH FROM (mf.updated_at - mf.created_at)) / 3600.0 
        ELSE NULL 
      END
    ), 0
  ) AS avg_ship_time_hours,
  COALESCE(
    COUNT(CASE WHEN mf.status IN ('shipped', 'completed') 
      AND EXTRACT(EPOCH FROM (mf.updated_at - mf.created_at)) <= 172800 
      THEN 1 END)::numeric
    / NULLIF(COUNT(CASE WHEN mf.status IN ('shipped', 'completed') THEN 1 END), 0) * 100
  , 100) AS on_time_percentage,
  COALESCE(
    COUNT(CASE WHEN wp.dispute_flag = true THEN 1 END)::numeric
    / NULLIF(COUNT(wp.id), 0) * 100
  , 0) AS dispute_rate,
  COALESCE(
    COUNT(CASE WHEN wp.status = 'reversed' THEN 1 END)::numeric
    / NULLIF(COUNT(wp.id), 0) * 100
  , 0) AS refund_rate,
  COALESCE(SUM(CASE WHEN vl.id IS NOT NULL THEN vl.amount ELSE 0 END), 0) AS total_liability,
  COUNT(DISTINCT mo.id) AS total_orders,
  COUNT(DISTINCT CASE WHEN mf.status = 'pending' THEN mf.id END) AS pending_fulfillments,
  LEAST(100, GREATEST(0,
    COALESCE(COUNT(CASE WHEN wp.dispute_flag = true THEN 1 END)::numeric / NULLIF(COUNT(wp.id), 0) * 200, 0) +
    COALESCE(COUNT(CASE WHEN wp.status = 'reversed' THEN 1 END)::numeric / NULLIF(COUNT(wp.id), 0) * 150, 0) +
    CASE WHEN COALESCE(
      COUNT(CASE WHEN mf.status IN ('shipped','completed') AND EXTRACT(EPOCH FROM (mf.updated_at - mf.created_at)) <= 172800 THEN 1 END)::numeric
      / NULLIF(COUNT(CASE WHEN mf.status IN ('shipped','completed') THEN 1 END), 0) * 100, 100) < 90 THEN 20 ELSE 0 END +
    CASE WHEN COALESCE(SUM(CASE WHEN vl.id IS NOT NULL THEN vl.amount ELSE 0 END), 0) > 0 THEN 15 ELSE 0 END
  )) AS risk_score
FROM public.wholesalers w
LEFT JOIN public.marketplace_orders mo ON mo.wholesaler_id = w.id
LEFT JOIN public.marketplace_fulfillments mf ON mf.wholesaler_id = w.id
LEFT JOIN public.wholesaler_payouts wp ON wp.wholesaler_id = w.id
LEFT JOIN public.vendor_liabilities vl ON vl.vendor_id = w.id AND vl.status != 'resolved'
GROUP BY w.id, w.contact_name, w.name;

CREATE UNIQUE INDEX idx_vendor_perf_vendor ON public.vendor_performance_summary(vendor_id);

-- 3. Add is_frozen column to wholesalers if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'wholesalers' AND column_name = 'is_frozen') THEN
    ALTER TABLE public.wholesalers ADD COLUMN is_frozen boolean DEFAULT false;
  END IF;
END $$;
