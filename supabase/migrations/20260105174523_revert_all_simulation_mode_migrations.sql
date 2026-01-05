-- =====================================================
-- STEP 1: Drop validation triggers (must be done first)
-- =====================================================
DROP TRIGGER IF EXISTS validate_invoice_simulation_mode_trigger ON invoices;
DROP TRIGGER IF EXISTS validate_order_simulation_mode_trigger ON wholesale_orders;
DROP TRIGGER IF EXISTS validate_payment_simulation_mode_trigger ON store_payments;
DROP TRIGGER IF EXISTS validate_contact_simulation_mode_trigger ON store_contacts;

-- =====================================================
-- STEP 2: Drop validation functions
-- =====================================================
DROP FUNCTION IF EXISTS validate_invoice_simulation_mode();
DROP FUNCTION IF EXISTS validate_order_simulation_mode();
DROP FUNCTION IF EXISTS validate_payment_simulation_mode();
DROP FUNCTION IF EXISTS validate_contact_simulation_mode();
DROP FUNCTION IF EXISTS get_current_simulation_mode();

-- =====================================================
-- STEP 3: Drop indexes (must be done before dropping columns)
-- =====================================================
DROP INDEX IF EXISTS public.idx_companies_is_simulation;
DROP INDEX IF EXISTS public.idx_invoices_is_simulation;
DROP INDEX IF EXISTS public.idx_wholesale_orders_is_simulation;
DROP INDEX IF EXISTS public.idx_store_payments_is_simulation;
DROP INDEX IF EXISTS public.idx_store_contacts_is_simulation;
DROP INDEX IF EXISTS public.idx_stores_is_simulation;

-- =====================================================
-- STEP 4: Remove is_simulation columns from all tables
-- =====================================================
ALTER TABLE public.companies DROP COLUMN IF EXISTS is_simulation;
ALTER TABLE public.invoices DROP COLUMN IF EXISTS is_simulation;
ALTER TABLE public.wholesale_orders DROP COLUMN IF EXISTS is_simulation;
ALTER TABLE public.store_payments DROP COLUMN IF EXISTS is_simulation;
ALTER TABLE public.store_contacts DROP COLUMN IF EXISTS is_simulation;
ALTER TABLE public.stores DROP COLUMN IF EXISTS is_simulation;

-- =====================================================
-- STEP 5: Revert sync_store_to_store_master function to original version

-- =====================================================
CREATE OR REPLACE FUNCTION sync_store_to_store_master()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO store_master (id, store_name, address, city, state, zip)
  VALUES (
    NEW.id,
    NEW.name,
    COALESCE(NEW.address_street, ''),
    COALESCE(NEW.address_city, ''),
    COALESCE(NEW.address_state, ''),
    COALESCE(NEW.address_zip, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
