-- Real Estate department re-wire: mirror the admin-only policies for realestate_worker.
-- Policies are permissive and OR'ed, so admins keep full access via existing policies.

CREATE POLICY "RE workers manage acquisitions" ON public.acquisitions_pipeline
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'realestate_worker'));

CREATE POLICY "RE workers manage closing partners" ON public.closing_partners
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'realestate_worker'));

CREATE POLICY "RE workers manage deal_closings" ON public.deal_closings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'realestate_worker'));

CREATE POLICY "RE workers manage expansion" ON public.expansion_cities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'realestate_worker'));

CREATE POLICY "RE workers manage investor_buy_boxes" ON public.investor_buy_boxes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'realestate_worker'));

CREATE POLICY "RE workers manage investor subscriptions" ON public.investor_subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'realestate_worker'));

CREATE POLICY "RE workers manage leads_raw" ON public.leads_raw
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'realestate_worker'));