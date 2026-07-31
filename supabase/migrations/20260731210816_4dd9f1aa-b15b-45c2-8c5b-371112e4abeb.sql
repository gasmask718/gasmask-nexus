
DROP POLICY IF EXISTS "Allow all access" ON public.outbound_call_queue;
DROP POLICY IF EXISTS "Enable access for auth users" ON public.outbound_call_queue;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.outbound_call_queue;

DROP POLICY IF EXISTS "Users can view relevant invoices" ON public.invoices;
DROP POLICY IF EXISTS "Elevated users can manage invoices" ON public.invoices;
CREATE POLICY "Elevated users can manage invoices" ON public.invoices FOR ALL TO authenticated
USING (is_owner(auth.uid()) OR is_admin(auth.uid()) OR is_elevated_user(auth.uid()))
WITH CHECK (is_owner(auth.uid()) OR is_admin(auth.uid()) OR is_elevated_user(auth.uid()));
