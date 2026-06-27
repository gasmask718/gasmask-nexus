DELETE FROM public.admin_notifications_log
WHERE event_type = 'customer_flagged'
  AND (
    related_id IN ('00000000-0000-0000-0000-000000000001','abcdefab-1234-5678-9012-000000000002')
    OR metadata->>'booking_id_short' IN ('FLAGTEST','abcdefab')
  );