
-- tt_bookings
DROP POLICY IF EXISTS "Authenticated users can manage tt_bookings" ON public.tt_bookings;
CREATE POLICY "tt_bookings_admin_all" ON public.tt_bookings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- tt_dispatch_requests
DROP POLICY IF EXISTS "Allow all access to tt_dispatch_requests" ON public.tt_dispatch_requests;
CREATE POLICY "tt_dispatch_requests_admin_all" ON public.tt_dispatch_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- tt_dispatches
DROP POLICY IF EXISTS "Authenticated users full access tt_dispatches" ON public.tt_dispatches;
CREATE POLICY "tt_dispatches_admin_all" ON public.tt_dispatches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "tt_dispatches_driver_select" ON public.tt_dispatches FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

-- tt_partners
DROP POLICY IF EXISTS "Authenticated users can manage tt_partners" ON public.tt_partners;
CREATE POLICY "tt_partners_admin_all" ON public.tt_partners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "tt_partners_self_update" ON public.tt_partners FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- tt_partner_assets (admin-only; partner_id is free-form text, no safe owner scope)
DROP POLICY IF EXISTS "Allow all access to tt_partner_assets" ON public.tt_partner_assets;
CREATE POLICY "tt_partner_assets_admin_all" ON public.tt_partner_assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- tt_partner_earnings
DROP POLICY IF EXISTS "Authenticated users can manage tt_partner_earnings" ON public.tt_partner_earnings;
CREATE POLICY "tt_partner_earnings_admin_all" ON public.tt_partner_earnings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "tt_partner_earnings_partner_select" ON public.tt_partner_earnings FOR SELECT TO authenticated
  USING (partner_id IN (SELECT id FROM public.tt_partners WHERE user_id = auth.uid()));

-- tt_booking_events
DROP POLICY IF EXISTS "Authenticated users can manage tt_booking_events" ON public.tt_booking_events;
CREATE POLICY "tt_booking_events_admin_all" ON public.tt_booking_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- tt_broadcast_quotes
DROP POLICY IF EXISTS "Authenticated users can manage tt_broadcast_quotes" ON public.tt_broadcast_quotes;
CREATE POLICY "tt_broadcast_quotes_admin_all" ON public.tt_broadcast_quotes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- tt_confirmation_requests
DROP POLICY IF EXISTS "Authenticated users can manage tt_confirmation_requests" ON public.tt_confirmation_requests;
CREATE POLICY "tt_confirmation_requests_admin_all" ON public.tt_confirmation_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- tt_corporate_accounts
DROP POLICY IF EXISTS "Authenticated users full access tt_corporate_accounts" ON public.tt_corporate_accounts;
CREATE POLICY "tt_corporate_accounts_admin_all" ON public.tt_corporate_accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- tt_customer_reviews
DROP POLICY IF EXISTS "Authenticated users full access tt_customer_reviews" ON public.tt_customer_reviews;
CREATE POLICY "tt_customer_reviews_public_select" ON public.tt_customer_reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "tt_customer_reviews_admin_write" ON public.tt_customer_reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- tt_driver_availability
DROP POLICY IF EXISTS "Authenticated users full access tt_driver_availability" ON public.tt_driver_availability;
CREATE POLICY "tt_driver_availability_admin_all" ON public.tt_driver_availability FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "tt_driver_availability_driver_rw" ON public.tt_driver_availability FOR ALL TO authenticated
  USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());

-- tt_notifications_log
DROP POLICY IF EXISTS "Authenticated users full access tt_notifications_log" ON public.tt_notifications_log;
CREATE POLICY "tt_notifications_log_admin_all" ON public.tt_notifications_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- tt_pricing_rules
DROP POLICY IF EXISTS "Authenticated users full access tt_pricing_rules" ON public.tt_pricing_rules;
CREATE POLICY "tt_pricing_rules_admin_all" ON public.tt_pricing_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- tt_vehicle_maintenance
DROP POLICY IF EXISTS "Authenticated users full access tt_vehicle_maintenance" ON public.tt_vehicle_maintenance;
CREATE POLICY "tt_vehicle_maintenance_admin_all" ON public.tt_vehicle_maintenance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- tt_vehicles
DROP POLICY IF EXISTS "Authenticated users can insert tt_vehicles" ON public.tt_vehicles;
DROP POLICY IF EXISTS "Authenticated users can update tt_vehicles" ON public.tt_vehicles;
DROP POLICY IF EXISTS "Authenticated users can delete tt_vehicles" ON public.tt_vehicles;
DROP POLICY IF EXISTS "Public can view active vehicles" ON public.tt_vehicles;
CREATE POLICY "tt_vehicles_public_select_active" ON public.tt_vehicles FOR SELECT TO anon, authenticated
  USING (is_active = true);
CREATE POLICY "tt_vehicles_admin_all" ON public.tt_vehicles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
