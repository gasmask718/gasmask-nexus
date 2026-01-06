-- Drop old permissive RLS policies that bypass simulation filtering on store_master
DROP POLICY IF EXISTS "Authenticated users can view store_master" ON public.store_master;
DROP POLICY IF EXISTS "Authenticated users can create store_master" ON public.store_master;
DROP POLICY IF EXISTS "Authenticated users can update store_master" ON public.store_master;

-- Drop old permissive RLS policies on crm_partners
DROP POLICY IF EXISTS "Authenticated users can view crm_partners" ON public.crm_partners;
DROP POLICY IF EXISTS "Authenticated users can create crm_partners" ON public.crm_partners;
DROP POLICY IF EXISTS "Authenticated users can update crm_partners" ON public.crm_partners;

-- Drop old permissive RLS policies on wholesale_orders
DROP POLICY IF EXISTS "Authenticated users can view wholesale_orders" ON public.wholesale_orders;
DROP POLICY IF EXISTS "Authenticated users can create wholesale_orders" ON public.wholesale_orders;
DROP POLICY IF EXISTS "Authenticated users can update wholesale_orders" ON public.wholesale_orders;

-- Drop old permissive RLS policies on store_tube_inventory
DROP POLICY IF EXISTS "Authenticated users can view store_tube_inventory" ON public.store_tube_inventory;
DROP POLICY IF EXISTS "Authenticated users can create store_tube_inventory" ON public.store_tube_inventory;
DROP POLICY IF EXISTS "Authenticated users can update store_tube_inventory" ON public.store_tube_inventory;

-- Drop old permissive RLS policies on store_contacts
DROP POLICY IF EXISTS "Authenticated users can view store_contacts" ON public.store_contacts;
DROP POLICY IF EXISTS "Authenticated users can create store_contacts" ON public.store_contacts;
DROP POLICY IF EXISTS "Authenticated users can update store_contacts" ON public.store_contacts;

-- Drop old permissive RLS policies on biker_routes
DROP POLICY IF EXISTS "Authenticated users can view biker_routes" ON public.biker_routes;
DROP POLICY IF EXISTS "Authenticated users can create biker_routes" ON public.biker_routes;
DROP POLICY IF EXISTS "Authenticated users can update biker_routes" ON public.biker_routes;

-- Drop old permissive RLS policies on crm_contacts
DROP POLICY IF EXISTS "Authenticated users can view crm_contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Authenticated users can create crm_contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Authenticated users can update crm_contacts" ON public.crm_contacts;