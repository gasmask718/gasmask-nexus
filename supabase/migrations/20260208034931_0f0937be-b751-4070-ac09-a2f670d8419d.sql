
-- Global Sell-Through Analytics view: joins sell-through summary with store_master for store_name
CREATE OR REPLACE VIEW public.v_global_sell_through_analytics AS
SELECT
  s.store_id,
  sm.store_name,
  sm.city,
  sm.state,
  s.brand_name,
  s.total_orders_lifetime,
  s.total_units_lifetime,
  s.total_tubes_lifetime,
  s.total_revenue_lifetime,
  s.first_order_date,
  s.last_order_date,
  s.days_since_last_order,
  s.avg_days_between_orders,
  s.min_days_between,
  s.max_days_between,
  s.orders_last_30d,
  s.orders_last_90d,
  s.revenue_last_30d,
  s.revenue_last_90d,
  s.revenue_per_day,
  s.order_frequency_class,
  s.projected_next_order
FROM v_store_brand_sell_through_summary s
JOIN store_master sm ON sm.id = s.store_id;
