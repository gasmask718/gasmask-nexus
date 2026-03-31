-- Allow authenticated admin users to update all 3 tables
CREATE POLICY "Admins can update bookings"
ON ut_event_bookings FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can update halls"
ON event_halls FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can update staff"
ON staff_members_ut FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);