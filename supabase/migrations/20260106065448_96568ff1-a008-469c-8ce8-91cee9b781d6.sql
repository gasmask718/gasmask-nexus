-- Complete Simulation Data Isolation Migration
-- This migration must be run in full to enable data isolation between modes

-- Step 1: Create helper function FIRST
CREATE OR REPLACE FUNCTION public.is_simulation_mode()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT (setting_value->>'mode')::text = 'simulation'
     FROM public.system_settings 
     WHERE setting_key = 'simulation_mode'),
    false
  )
$$;

-- Step 2: Add is_simulation columns to core tables
ALTER TABLE public.store_master ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_master_simulation ON public.store_master(is_simulation);

ALTER TABLE public.crm_partners ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_partners_simulation ON public.crm_partners(is_simulation);

ALTER TABLE public.wholesale_orders ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wholesale_orders_simulation ON public.wholesale_orders(is_simulation);

ALTER TABLE public.store_tube_inventory ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_tube_inventory_simulation ON public.store_tube_inventory(is_simulation);

ALTER TABLE public.store_contacts ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS idx_store_contacts_simulation ON public.store_contacts(is_simulation);

ALTER TABLE public.biker_routes ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS idx_biker_routes_simulation ON public.biker_routes(is_simulation);

ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS is_simulation BOOLEAN DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_simulation ON public.crm_contacts(is_simulation);

-- Step 3: Create RLS policies for store_master
DROP POLICY IF EXISTS "store_master_simulation_select" ON public.store_master;
CREATE POLICY "store_master_simulation_select" ON public.store_master
FOR SELECT USING (is_simulation = public.is_simulation_mode());

DROP POLICY IF EXISTS "store_master_simulation_insert" ON public.store_master;
CREATE POLICY "store_master_simulation_insert" ON public.store_master
FOR INSERT WITH CHECK (is_simulation = public.is_simulation_mode());

DROP POLICY IF EXISTS "store_master_simulation_update" ON public.store_master;
CREATE POLICY "store_master_simulation_update" ON public.store_master
FOR UPDATE USING (is_simulation = public.is_simulation_mode());

DROP POLICY IF EXISTS "store_master_simulation_delete" ON public.store_master;
CREATE POLICY "store_master_simulation_delete" ON public.store_master
FOR DELETE USING (is_simulation = public.is_simulation_mode());

-- Step 4: Create RLS policies for crm_partners
DROP POLICY IF EXISTS "crm_partners_simulation_select" ON public.crm_partners;
CREATE POLICY "crm_partners_simulation_select" ON public.crm_partners
FOR SELECT USING (is_simulation = public.is_simulation_mode());

DROP POLICY IF EXISTS "crm_partners_simulation_insert" ON public.crm_partners;
CREATE POLICY "crm_partners_simulation_insert" ON public.crm_partners
FOR INSERT WITH CHECK (is_simulation = public.is_simulation_mode());

DROP POLICY IF EXISTS "crm_partners_simulation_update" ON public.crm_partners;
CREATE POLICY "crm_partners_simulation_update" ON public.crm_partners
FOR UPDATE USING (is_simulation = public.is_simulation_mode());

DROP POLICY IF EXISTS "crm_partners_simulation_delete" ON public.crm_partners;
CREATE POLICY "crm_partners_simulation_delete" ON public.crm_partners
FOR DELETE USING (is_simulation = public.is_simulation_mode());

-- Step 5: Create RLS policies for wholesale_orders
DROP POLICY IF EXISTS "wholesale_orders_simulation_select" ON public.wholesale_orders;
CREATE POLICY "wholesale_orders_simulation_select" ON public.wholesale_orders
FOR SELECT USING (is_simulation = public.is_simulation_mode());

DROP POLICY IF EXISTS "wholesale_orders_simulation_insert" ON public.wholesale_orders;
CREATE POLICY "wholesale_orders_simulation_insert" ON public.wholesale_orders
FOR INSERT WITH CHECK (is_simulation = public.is_simulation_mode());

DROP POLICY IF EXISTS "wholesale_orders_simulation_update" ON public.wholesale_orders;
CREATE POLICY "wholesale_orders_simulation_update" ON public.wholesale_orders
FOR UPDATE USING (is_simulation = public.is_simulation_mode());

-- Step 6: Create RLS policies for store_tube_inventory
DROP POLICY IF EXISTS "store_tube_inventory_simulation_select" ON public.store_tube_inventory;
CREATE POLICY "store_tube_inventory_simulation_select" ON public.store_tube_inventory
FOR SELECT USING (is_simulation = public.is_simulation_mode());

DROP POLICY IF EXISTS "store_tube_inventory_simulation_insert" ON public.store_tube_inventory;
CREATE POLICY "store_tube_inventory_simulation_insert" ON public.store_tube_inventory
FOR INSERT WITH CHECK (is_simulation = public.is_simulation_mode());

DROP POLICY IF EXISTS "store_tube_inventory_simulation_update" ON public.store_tube_inventory;
CREATE POLICY "store_tube_inventory_simulation_update" ON public.store_tube_inventory
FOR UPDATE USING (is_simulation = public.is_simulation_mode());

-- Step 7: Create RLS policies for store_contacts
DROP POLICY IF EXISTS "store_contacts_simulation_select" ON public.store_contacts;
CREATE POLICY "store_contacts_simulation_select" ON public.store_contacts
FOR SELECT USING (is_simulation = public.is_simulation_mode());

DROP POLICY IF EXISTS "store_contacts_simulation_insert" ON public.store_contacts;
CREATE POLICY "store_contacts_simulation_insert" ON public.store_contacts
FOR INSERT WITH CHECK (is_simulation = public.is_simulation_mode());

DROP POLICY IF EXISTS "store_contacts_simulation_update" ON public.store_contacts;
CREATE POLICY "store_contacts_simulation_update" ON public.store_contacts
FOR UPDATE USING (is_simulation = public.is_simulation_mode());

-- Step 8: Create RLS policies for biker_routes
DROP POLICY IF EXISTS "biker_routes_simulation_select" ON public.biker_routes;
CREATE POLICY "biker_routes_simulation_select" ON public.biker_routes
FOR SELECT USING (is_simulation = public.is_simulation_mode());

DROP POLICY IF EXISTS "biker_routes_simulation_insert" ON public.biker_routes;
CREATE POLICY "biker_routes_simulation_insert" ON public.biker_routes
FOR INSERT WITH CHECK (is_simulation = public.is_simulation_mode());

DROP POLICY IF EXISTS "biker_routes_simulation_update" ON public.biker_routes;
CREATE POLICY "biker_routes_simulation_update" ON public.biker_routes
FOR UPDATE USING (is_simulation = public.is_simulation_mode());

-- Step 9: Create RLS policies for crm_contacts
DROP POLICY IF EXISTS "crm_contacts_simulation_select" ON public.crm_contacts;
CREATE POLICY "crm_contacts_simulation_select" ON public.crm_contacts
FOR SELECT USING (is_simulation = public.is_simulation_mode());

DROP POLICY IF EXISTS "crm_contacts_simulation_insert" ON public.crm_contacts;
CREATE POLICY "crm_contacts_simulation_insert" ON public.crm_contacts
FOR INSERT WITH CHECK (is_simulation = public.is_simulation_mode());

DROP POLICY IF EXISTS "crm_contacts_simulation_update" ON public.crm_contacts;
CREATE POLICY "crm_contacts_simulation_update" ON public.crm_contacts
FOR UPDATE USING (is_simulation = public.is_simulation_mode());