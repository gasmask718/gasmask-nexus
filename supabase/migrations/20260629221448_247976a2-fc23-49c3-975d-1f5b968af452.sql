
-- Pro subscriptions
CREATE TABLE IF NOT EXISTS public.dd_pro_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text DEFAULT 'pro' CHECK (plan IN ('pro','enterprise')),
  status text DEFAULT 'active' CHECK (status IN ('trial','active','past_due','cancelled','paused')),
  trial_ends_at timestamptz,
  billing_cycle_day int DEFAULT 1,
  monthly_price numeric DEFAULT 97,
  stripe_subscription_id text,
  stripe_customer_id text,
  next_billing_date date,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_pro_subscriptions TO authenticated;
GRANT ALL ON public.dd_pro_subscriptions TO service_role;
ALTER TABLE public.dd_pro_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stores view own sub" ON public.dd_pro_subscriptions;
CREATE POLICY "Stores view own sub" ON public.dd_pro_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admin full access subs" ON public.dd_pro_subscriptions;
CREATE POLICY "Admin full access subs" ON public.dd_pro_subscriptions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Store inventory
CREATE TABLE IF NOT EXISTS public.dd_store_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products_all(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  sku text,
  current_qty int DEFAULT 0,
  reorder_point int DEFAULT 5,
  reorder_qty int DEFAULT 20,
  unit_cost numeric,
  selling_price numeric,
  location_in_store text,
  notes text,
  last_updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(store_account_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_store_inventory TO authenticated;
GRANT ALL ON public.dd_store_inventory TO service_role;
ALTER TABLE public.dd_store_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stores manage own inventory" ON public.dd_store_inventory;
CREATE POLICY "Stores manage own inventory" ON public.dd_store_inventory
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admin full access inventory" ON public.dd_store_inventory;
CREATE POLICY "Admin full access inventory" ON public.dd_store_inventory
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Sales log
CREATE TABLE IF NOT EXISTS public.dd_store_sales_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products_all(id) ON DELETE SET NULL,
  qty_sold int NOT NULL,
  sale_price numeric,
  sale_date date DEFAULT (now()::date),
  notes text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_store_sales_log TO authenticated;
GRANT ALL ON public.dd_store_sales_log TO service_role;
ALTER TABLE public.dd_store_sales_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stores manage own sales" ON public.dd_store_sales_log;
CREATE POLICY "Stores manage own sales" ON public.dd_store_sales_log
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admin full access sales" ON public.dd_store_sales_log;
CREATE POLICY "Admin full access sales" ON public.dd_store_sales_log
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_dd_store_inventory_store ON public.dd_store_inventory(store_account_id);
CREATE INDEX IF NOT EXISTS idx_dd_store_sales_log_store_date ON public.dd_store_sales_log(store_account_id, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_dd_pro_subs_status ON public.dd_pro_subscriptions(status);

-- Analytics RPC
CREATE OR REPLACE FUNCTION public.dd_store_inventory_analytics(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'top_sellers', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
      SELECT
        si.product_name,
        si.product_id,
        COALESCE(SUM(sl.qty_sold), 0) AS units_sold_30d,
        COALESCE(SUM(sl.qty_sold * sl.sale_price), 0) AS revenue_30d,
        si.current_qty AS stock_left,
        CASE
          WHEN si.current_qty <= si.reorder_point THEN 'reorder_now'
          WHEN si.current_qty <= si.reorder_point * 2 THEN 'reorder_soon'
          ELSE 'ok'
        END AS reorder_status
      FROM dd_store_inventory si
      LEFT JOIN dd_store_sales_log sl
        ON sl.product_id = si.product_id
        AND sl.store_account_id = p_store_id
        AND sl.sale_date >= (now()::date - 30)
      WHERE si.store_account_id = p_store_id
      GROUP BY si.product_name, si.product_id, si.current_qty, si.reorder_point
      ORDER BY units_sold_30d DESC
      LIMIT 10
    ) t),
    'reorder_alerts', (SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
      SELECT product_name, current_qty, reorder_point, reorder_qty,
        'Stock at ' || current_qty || ' units — reorder ' || reorder_qty || ' units now' AS alert_message
      FROM dd_store_inventory
      WHERE store_account_id = p_store_id AND current_qty <= reorder_point
      ORDER BY current_qty ASC
    ) r),
    'slow_movers', (SELECT COALESCE(jsonb_agg(s), '[]'::jsonb) FROM (
      SELECT si.product_name, si.current_qty, COALESCE(SUM(sl.qty_sold), 0) AS sold_30d
      FROM dd_store_inventory si
      LEFT JOIN dd_store_sales_log sl
        ON sl.product_id = si.product_id
        AND sl.store_account_id = p_store_id
        AND sl.sale_date >= (now()::date - 30)
      WHERE si.store_account_id = p_store_id
      GROUP BY si.product_name, si.current_qty
      HAVING COALESCE(SUM(sl.qty_sold), 0) < 3 AND si.current_qty > 10
      ORDER BY sold_30d ASC
      LIMIT 5
    ) s),
    'total_inventory_value', (SELECT COALESCE(SUM(current_qty * unit_cost), 0) FROM dd_store_inventory WHERE store_account_id = p_store_id),
    'total_retail_value', (SELECT COALESCE(SUM(current_qty * selling_price), 0) FROM dd_store_inventory WHERE store_account_id = p_store_id)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dd_store_inventory_analytics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dd_store_inventory_analytics(uuid) TO service_role;
