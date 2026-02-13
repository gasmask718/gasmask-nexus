
-- Admin-scoped RPC: View any ambassador's profit dashboard (admin/owner only)
CREATE OR REPLACE FUNCTION public.get_ambassador_profit_dashboard(p_ambassador_id uuid)
RETURNS SETOF v_ambassador_profit_dashboard
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM v_ambassador_profit_dashboard
  WHERE ambassador_id = p_ambassador_id;
$$;

-- Admin-scoped RPC: View any ambassador's profit breakdown (admin/owner only)
CREATE OR REPLACE FUNCTION public.get_ambassador_profit_breakdown(
  p_ambassador_id uuid,
  p_brand text DEFAULT NULL,
  p_store_id uuid DEFAULT NULL,
  p_sale_channel text DEFAULT NULL
)
RETURNS SETOF v_ambassador_profit_breakdown
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM v_ambassador_profit_breakdown
  WHERE ambassador_id = p_ambassador_id
    AND (p_brand IS NULL OR brand = p_brand)
    AND (p_store_id IS NULL OR store_id = p_store_id)
    AND (p_sale_channel IS NULL OR sale_channel = p_sale_channel)
  ORDER BY sale_month DESC;
$$;
