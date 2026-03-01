
-- Drop old normalize_phone with conflicting param name
DROP FUNCTION IF EXISTS public.normalize_phone(text) CASCADE;

-- Drop old RPCs that depend on it
DROP FUNCTION IF EXISTS public.resolve_previous_customers(integer) CASCADE;
DROP FUNCTION IF EXISTS public.resolve_previous_customers_count() CASCADE;
DROP FUNCTION IF EXISTS public.resolve_audience_segment(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.resolve_audience_count(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.audience_diagnostics() CASCADE;

-- Drop views
DROP VIEW IF EXISTS public.invoices_unified CASCADE;
DROP VIEW IF EXISTS public.invoice_source_summary CASCADE;
DROP VIEW IF EXISTS public.unified_customer_orders CASCADE;
