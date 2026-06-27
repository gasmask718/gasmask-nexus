CREATE OR REPLACE FUNCTION public.get_ops_dashboard_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  today_start TIMESTAMPTZ := DATE_TRUNC('day', NOW());
  one_hour_ago TIMESTAMPTZ := NOW() - INTERVAL '1 hour';
  twenty_four_hr_ago TIMESTAMPTZ := NOW() - INTERVAL '24 hours';
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')) THEN
    RAISE EXCEPTION 'access denied';
  END IF;

  SELECT jsonb_build_object(
    'as_of', NOW(),
    'bookings_today', jsonb_build_object(
      'count', (SELECT COUNT(*) FROM tt_bookings WHERE created_at >= today_start),
      'revenue', (SELECT COALESCE(SUM(total_price), 0) FROM tt_bookings WHERE created_at >= today_start AND status NOT IN ('cancelled','declined')),
      'by_service', COALESCE((
        SELECT jsonb_object_agg(COALESCE(service_type,'unknown'), count)
        FROM (
          SELECT service_type, COUNT(*) AS count
          FROM tt_bookings
          WHERE created_at >= today_start
          GROUP BY service_type
        ) s
      ), '{}'::jsonb)
    ),
    'pending_queue', jsonb_build_object(
      'total', (SELECT COUNT(*) FROM tt_bookings WHERE status = 'pending'),
      'oldest_minutes', COALESCE((SELECT EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))/60 FROM tt_bookings WHERE status='pending'), 0),
      'over_1hr', (SELECT COUNT(*) FROM tt_bookings WHERE status='pending' AND created_at < one_hour_ago)
    ),
    'dispatch_failures_1hr', (SELECT COUNT(*) FROM admin_notifications_log WHERE event_type='dispatch_failure' AND sent_at >= one_hour_ago),
    'payment_failures_24hr', (SELECT COUNT(*) FROM tt_bookings WHERE payment_status='failed' AND updated_at >= twenty_four_hr_ago),
    'sla_breaches_active', (SELECT COUNT(*) FROM admin_notifications_log WHERE event_type='sla_breach' AND sent_at >= twenty_four_hr_ago),
    'partner_health', jsonb_build_object(
      'platinum', (SELECT COUNT(*) FROM partner_performance_snapshots WHERE snapshot_date=CURRENT_DATE AND performance_tier='platinum'),
      'gold',     (SELECT COUNT(*) FROM partner_performance_snapshots WHERE snapshot_date=CURRENT_DATE AND performance_tier='gold'),
      'silver',   (SELECT COUNT(*) FROM partner_performance_snapshots WHERE snapshot_date=CURRENT_DATE AND performance_tier='silver'),
      'bronze',   (SELECT COUNT(*) FROM partner_performance_snapshots WHERE snapshot_date=CURRENT_DATE AND performance_tier='bronze'),
      'at_risk',  (SELECT COUNT(*) FROM partner_performance_snapshots WHERE snapshot_date=CURRENT_DATE AND performance_tier='at_risk')
    ),
    'customer_alerts_24hr', (SELECT COUNT(*) FROM admin_notifications_log WHERE event_type IN ('customer_flagged','high_value_booking') AND sent_at >= twenty_four_hr_ago)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ops_dashboard_metrics() TO authenticated;