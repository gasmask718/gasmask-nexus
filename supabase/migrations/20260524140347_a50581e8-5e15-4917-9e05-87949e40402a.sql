
-- ============ wholesaler_orders ============
DROP POLICY IF EXISTS "Authenticated users can view wholesaler_orders" ON public.wholesaler_orders;
DROP POLICY IF EXISTS "Authenticated users can insert wholesaler_orders" ON public.wholesaler_orders;
DROP POLICY IF EXISTS "Authenticated users can update wholesaler_orders" ON public.wholesaler_orders;
DROP POLICY IF EXISTS "Authenticated users can delete wholesaler_orders" ON public.wholesaler_orders;

CREATE POLICY "wholesaler_orders_select_owner_or_admin" ON public.wholesaler_orders
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.wholesaler_profiles wp WHERE wp.id = wholesaler_orders.wholesaler_id AND wp.user_id = auth.uid())
);

CREATE POLICY "wholesaler_orders_insert_owner_or_admin" ON public.wholesaler_orders
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.wholesaler_profiles wp WHERE wp.id = wholesaler_orders.wholesaler_id AND wp.user_id = auth.uid())
);

CREATE POLICY "wholesaler_orders_update_owner_or_admin" ON public.wholesaler_orders
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.wholesaler_profiles wp WHERE wp.id = wholesaler_orders.wholesaler_id AND wp.user_id = auth.uid())
);

CREATE POLICY "wholesaler_orders_delete_admin_only" ON public.wholesaler_orders
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ products (catalog) ============
DROP POLICY IF EXISTS products_insert_authenticated ON public.products;
DROP POLICY IF EXISTS products_update_authenticated ON public.products;
DROP POLICY IF EXISTS products_delete_authenticated ON public.products;

CREATE POLICY "products_insert_admin_only" ON public.products
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "products_update_admin_only" ON public.products
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "products_delete_admin_only" ON public.products
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ wholesale_products ============
DROP POLICY IF EXISTS "Anyone can view wholesale products" ON public.wholesale_products;
DROP POLICY IF EXISTS "Wholesalers can manage their products" ON public.wholesale_products;
DROP POLICY IF EXISTS "Authenticated can view wholesale_products" ON public.wholesale_products;
DROP POLICY IF EXISTS "Authenticated can insert wholesale_products" ON public.wholesale_products;
DROP POLICY IF EXISTS "Authenticated can update wholesale_products" ON public.wholesale_products;
DROP POLICY IF EXISTS "Authenticated can delete wholesale_products" ON public.wholesale_products;

-- ============ wholesale_orders ============
DROP POLICY IF EXISTS "Authenticated can view wholesale_orders" ON public.wholesale_orders;
DROP POLICY IF EXISTS "Authenticated can insert wholesale_orders" ON public.wholesale_orders;
DROP POLICY IF EXISTS "Authenticated can update wholesale_orders" ON public.wholesale_orders;
DROP POLICY IF EXISTS "Authenticated can delete wholesale_orders" ON public.wholesale_orders;

-- ============ store_inventory ============
DROP POLICY IF EXISTS "Authenticated users can view store_inventory" ON public.store_inventory;
DROP POLICY IF EXISTS "Authenticated users can insert store_inventory" ON public.store_inventory;
DROP POLICY IF EXISTS "Authenticated users can update store_inventory" ON public.store_inventory;
DROP POLICY IF EXISTS "Authenticated users can delete store_inventory" ON public.store_inventory;

CREATE POLICY "store_inventory_admin_all" ON public.store_inventory
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
