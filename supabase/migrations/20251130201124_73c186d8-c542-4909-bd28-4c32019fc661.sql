-- DYNASTY OS - Phase 2: Database Standards (Clean)

-- 1. Soft-delete indexes (only for tables with deleted_at)
CREATE INDEX IF NOT EXISTS idx_crm_contacts_active ON public.crm_contacts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_active ON public.orders(deleted_at) WHERE deleted_at IS NULL;

-- 2. Performance indexes on orders
CREATE INDEX IF NOT EXISTS idx_orders_business_id ON public.orders(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON public.orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_wholesaler_id ON public.orders(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON public.orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- 3. Stores indexes
CREATE INDEX IF NOT EXISTS idx_stores_company_id ON public.stores(company_id);
CREATE INDEX IF NOT EXISTS idx_stores_status ON public.stores(status);
CREATE INDEX IF NOT EXISTS idx_stores_region_id ON public.stores(region_id);

-- 4. CRM indexes
CREATE INDEX IF NOT EXISTS idx_crm_contacts_business_id ON public.crm_contacts(business_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_created_at ON public.crm_contacts(created_at DESC);

-- 5. Driver/Biker profiles indexes
CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_id ON public.driver_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_biker_profiles_user_id ON public.biker_profiles(user_id);

-- 6. Soft delete helper function
CREATE OR REPLACE FUNCTION public.soft_delete(_table_name text, _record_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = now() WHERE id = $1', _table_name) USING _record_id;
END;
$$;

-- 7. Restore from soft delete function
CREATE OR REPLACE FUNCTION public.restore_deleted(_table_name text, _record_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = NULL WHERE id = $1', _table_name) USING _record_id;
END;
$$;