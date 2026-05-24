
-- wholesaler_orders
DROP POLICY IF EXISTS "wholesaler_orders_read" ON public.wholesaler_orders;
DROP POLICY IF EXISTS "wholesaler_orders_insert" ON public.wholesaler_orders;
DROP POLICY IF EXISTS "wholesaler_orders_update" ON public.wholesaler_orders;
DROP POLICY IF EXISTS "wholesaler_orders_delete" ON public.wholesaler_orders;

-- store_inventory
DROP POLICY IF EXISTS "Allow authenticated read store_inventory" ON public.store_inventory;
DROP POLICY IF EXISTS "Allow authenticated insert store_inventory" ON public.store_inventory;
DROP POLICY IF EXISTS "Allow authenticated update store_inventory" ON public.store_inventory;
DROP POLICY IF EXISTS "Allow authenticated delete store_inventory" ON public.store_inventory;

-- wholesale_products
DROP POLICY IF EXISTS "Allow authenticated read wholesale_products" ON public.wholesale_products;
DROP POLICY IF EXISTS "Allow authenticated insert wholesale_products" ON public.wholesale_products;
DROP POLICY IF EXISTS "Allow authenticated update wholesale_products" ON public.wholesale_products;

-- wholesale_orders
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.wholesale_orders;
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.wholesale_orders;
