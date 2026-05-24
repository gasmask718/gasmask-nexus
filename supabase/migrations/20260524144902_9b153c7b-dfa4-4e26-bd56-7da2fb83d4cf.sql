
DROP POLICY IF EXISTS "Authenticated users can manage broadcast quotes" ON public.tt_broadcast_quotes;
DROP POLICY IF EXISTS "Authenticated users full access on tt_corporate_accounts" ON public.tt_corporate_accounts;
DROP POLICY IF EXISTS "Authenticated users full access on tt_customer_reviews" ON public.tt_customer_reviews;
DROP POLICY IF EXISTS "Authenticated users full access on tt_dispatches" ON public.tt_dispatches;
DROP POLICY IF EXISTS "Authenticated users full access on tt_driver_availability" ON public.tt_driver_availability;
DROP POLICY IF EXISTS "Authenticated users full access on tt_notifications_log" ON public.tt_notifications_log;
DROP POLICY IF EXISTS "Authenticated users full access on tt_pricing_rules" ON public.tt_pricing_rules;
DROP POLICY IF EXISTS "Authenticated users full access on tt_vehicle_maintenance" ON public.tt_vehicle_maintenance;
DROP POLICY IF EXISTS "Authenticated users can delete vehicles" ON public.tt_vehicles;
DROP POLICY IF EXISTS "Authenticated users can insert vehicles" ON public.tt_vehicles;
DROP POLICY IF EXISTS "Authenticated users can update vehicles" ON public.tt_vehicles;
