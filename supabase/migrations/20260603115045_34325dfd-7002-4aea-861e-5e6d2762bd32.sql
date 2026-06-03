DELETE FROM tt_dispatch_requests WHERE booking_id = 'a76e979c-aa92-4074-a219-8fbd2caf3e24';
DELETE FROM tt_bookings WHERE id = 'a76e979c-aa92-4074-a219-8fbd2caf3e24';
-- driver references partner via owner_partner_id, delete driver first
DELETE FROM tt_drivers WHERE phone = '+17183089391' AND first_name = 'TEST_SYNTHETIC';
DELETE FROM tt_partners WHERE name = 'TEST_SYNTHETIC_DISPATCH' AND phone = '+17183089391';
UPDATE tt_drivers SET status = 'active'
  WHERE (first_name || ' ' || last_name) IN ('TEST_Driver A','TEST_Driver B','TEST_Driver C')
    AND status != 'active';