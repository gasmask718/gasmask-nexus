-- B4.4 Supplier RLS isolation: allow wholesalers to view their own routing decisions
DROP POLICY IF EXISTS "Wholesalers view own routing" ON public.order_routing;
CREATE POLICY "Wholesalers view own routing"
  ON public.order_routing FOR SELECT
  TO authenticated
  USING (
    assigned_wholesaler_id IN (
      SELECT id FROM public.wholesaler_profiles WHERE user_id = auth.uid()
    )
  );
