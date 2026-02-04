-- GUARDRAIL 1: RLS Policy to restrict profit field access
-- Only owner, admin, accountant roles can read profit/cost columns

-- First, create a security definer function to check finance roles
CREATE OR REPLACE FUNCTION public.has_finance_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('owner', 'admin', 'accountant')
  )
$$;

-- Create a secure view for invoice line items that hides profit from non-finance roles
CREATE OR REPLACE VIEW public.v_invoice_line_items_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  invoice_id,
  product_id,
  product_name,
  brand,
  brand_id,
  quantity,
  unit_price,
  total,
  unit_type,
  tubes_equivalent,
  created_at,
  sale_channel,
  sale_unit,
  units_per_box_snapshot,
  -- Only show profit fields if user has finance access
  CASE WHEN public.has_finance_access(auth.uid()) THEN cost_per_unit_at_sale ELSE NULL END as cost_per_unit_at_sale,
  CASE WHEN public.has_finance_access(auth.uid()) THEN profit_at_sale ELSE NULL END as profit_at_sale
FROM public.invoice_line_items;

COMMENT ON VIEW public.v_invoice_line_items_safe IS 'Safe view that hides profit/cost fields from non-finance roles. ⚠️ NEVER expose profit data outside Finance dashboards.';

-- Grant access to the view
GRANT SELECT ON public.v_invoice_line_items_safe TO authenticated;