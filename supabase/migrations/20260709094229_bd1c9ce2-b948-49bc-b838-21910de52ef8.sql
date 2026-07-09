
CREATE POLICY "casgn_own_select" ON public.clipper_assignments
  FOR SELECT TO authenticated
  USING (clipper_id IN (SELECT id FROM public.clipper_accounts WHERE user_id = auth.uid()));

CREATE POLICY "ccv_own_select" ON public.clipper_conversions
  FOR SELECT TO authenticated
  USING (clipper_id IN (SELECT id FROM public.clipper_accounts WHERE user_id = auth.uid()));

CREATE POLICY "cp_own_select" ON public.clipper_payouts
  FOR SELECT TO authenticated
  USING (clipper_id IN (SELECT id FROM public.clipper_accounts WHERE user_id = auth.uid()));
