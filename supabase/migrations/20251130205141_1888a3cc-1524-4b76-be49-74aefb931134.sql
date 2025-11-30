-- SECTION 2.2: Soft-Delete Pattern for core tables

-- Add deleted_at to tables that need it
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.ambassadors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.wholesalers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE public.driver_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL;

-- Create partial indexes for soft-delete (active records only)
CREATE INDEX IF NOT EXISTS idx_stores_active ON public.stores(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_active ON public.crm_contacts(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ambassadors_active ON public.ambassadors(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wholesalers_active ON public.wholesalers(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_driver_profiles_active ON public.driver_profiles(id) WHERE deleted_at IS NULL;

-- Additional indexes for orders table (existing)
CREATE INDEX IF NOT EXISTS idx_orders_active ON public.orders(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);

-- SECTION 5.2: Schema History Table
CREATE TABLE IF NOT EXISTS public.schema_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number SERIAL,
  table_name TEXT NOT NULL,
  change_type TEXT NOT NULL,
  change_description TEXT,
  sql_executed TEXT,
  executed_by UUID,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_reversible BOOLEAN DEFAULT true,
  rollback_sql TEXT
);

CREATE INDEX IF NOT EXISTS idx_schema_history_table ON public.schema_history(table_name);
CREATE INDEX IF NOT EXISTS idx_schema_history_version ON public.schema_history(version_number DESC);

ALTER TABLE public.schema_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view schema history" ON public.schema_history FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert schema history" ON public.schema_history FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- Soft delete helper functions
CREATE OR REPLACE FUNCTION public.soft_delete_record(p_table TEXT, p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = now() WHERE id = $1', p_table) USING p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_soft_deleted(p_table TEXT, p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  EXECUTE format('UPDATE %I SET deleted_at = NULL WHERE id = $1', p_table) USING p_id;
END;
$$;