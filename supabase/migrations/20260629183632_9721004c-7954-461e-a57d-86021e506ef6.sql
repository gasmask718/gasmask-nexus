CREATE OR REPLACE FUNCTION public.dd_inventory_forecast(p_days_ahead int DEFAULT 30)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  retail_price numeric,
  wholesaler_id uuid,
  current_stock int,
  daily_velocity numeric,
  days_until_stockout numeric,
  stockout_date date,
  units_needed_to_cover int,
  risk_level text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH sales_velocity AS (
    SELECT
      moi.product_id,
      (SUM(COALESCE(moi.qty,1))::numeric) / 30.0 AS daily_velocity
    FROM marketplace_order_items moi
    JOIN marketplace_orders mo ON mo.id = moi.order_id
    WHERE mo.created_at > now() - interval '30 days'
      AND mo.status = 'paid'
    GROUP BY moi.product_id
  )
  SELECT
    pa.id AS product_id,
    pa.product_name AS product_name,
    pa.retail_price AS retail_price,
    pa.wholesaler_id AS wholesaler_id,
    COALESCE(pa.inventory_qty,0) AS current_stock,
    COALESCE(sv.daily_velocity, 0) AS daily_velocity,
    CASE
      WHEN COALESCE(sv.daily_velocity, 0) = 0 THEN 999
      ELSE ROUND(COALESCE(pa.inventory_qty,0)::numeric / sv.daily_velocity, 1)
    END AS days_until_stockout,
    CASE
      WHEN COALESCE(sv.daily_velocity, 0) = 0 THEN (now() + interval '999 days')::date
      ELSE (now() + ((COALESCE(pa.inventory_qty,0)::numeric / sv.daily_velocity)::text || ' days')::interval)::date
    END AS stockout_date,
    GREATEST(0, CEIL(COALESCE(sv.daily_velocity,0) * p_days_ahead - COALESCE(pa.inventory_qty,0)))::int AS units_needed_to_cover,
    CASE
      WHEN COALESCE(sv.daily_velocity, 0) = 0 THEN 'no_sales'
      WHEN COALESCE(pa.inventory_qty,0)::numeric / sv.daily_velocity <= 7 THEN 'critical'
      WHEN COALESCE(pa.inventory_qty,0)::numeric / sv.daily_velocity <= 14 THEN 'warning'
      WHEN COALESCE(pa.inventory_qty,0)::numeric / sv.daily_velocity <= 30 THEN 'monitor'
      ELSE 'healthy'
    END AS risk_level
  FROM products_all pa
  LEFT JOIN sales_velocity sv ON sv.product_id = pa.id
  WHERE pa.status = 'active'
    AND pa.track_inventory = true
  ORDER BY
    CASE WHEN COALESCE(sv.daily_velocity,0) = 0 THEN 999
         ELSE COALESCE(pa.inventory_qty,0)::numeric / sv.daily_velocity END ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dd_inventory_forecast(int) TO authenticated, service_role;