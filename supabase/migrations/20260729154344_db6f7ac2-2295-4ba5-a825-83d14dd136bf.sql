
-- ============ wholesale_orders ============
DROP POLICY IF EXISTS wholesale_orders_simulation_insert ON public.wholesale_orders;
DROP POLICY IF EXISTS wholesale_orders_simulation_select ON public.wholesale_orders;
DROP POLICY IF EXISTS wholesale_orders_simulation_update ON public.wholesale_orders;
DROP POLICY IF EXISTS "Admins and drivers can update orders" ON public.wholesale_orders;
DROP POLICY IF EXISTS "Users can view their related orders" ON public.wholesale_orders;

CREATE POLICY wholesale_orders_admin_all ON public.wholesale_orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY wholesale_orders_select_owner_or_driver ON public.wholesale_orders
  FOR SELECT TO authenticated
  USING (
    driver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.wholesaler_profiles wp
      WHERE wp.id = wholesale_orders.wholesaler_id AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY wholesale_orders_insert_owner ON public.wholesale_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.wholesaler_profiles wp
      WHERE wp.id = wholesale_orders.wholesaler_id AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY wholesale_orders_update_owner_or_driver ON public.wholesale_orders
  FOR UPDATE TO authenticated
  USING (
    driver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.wholesaler_profiles wp
      WHERE wp.id = wholesale_orders.wholesaler_id AND wp.user_id = auth.uid()
    )
  );

-- ============ store_inventory ============
CREATE POLICY store_inventory_store_select ON public.store_inventory
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.store_profiles sp
      WHERE sp.id = store_inventory.store_id AND sp.user_id = auth.uid()
    )
  );

-- ============ wholesale_products ============
CREATE POLICY wholesale_products_wholesaler_manage ON public.wholesale_products
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.wholesaler_profiles wp
      WHERE wp.id = wholesale_products.wholesaler_id AND wp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.wholesaler_profiles wp
      WHERE wp.id = wholesale_products.wholesaler_id AND wp.user_id = auth.uid()
    )
  );
