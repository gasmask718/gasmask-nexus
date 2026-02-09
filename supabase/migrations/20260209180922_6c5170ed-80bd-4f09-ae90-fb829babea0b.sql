
-- Fix compute_tubes_equivalent: column is base_units_per_unit, not tubes_per_unit
CREATE OR REPLACE FUNCTION public.compute_tubes_equivalent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conversion_rate NUMERIC;
BEGIN
  SELECT base_units_per_unit INTO conversion_rate
  FROM public.product_conversions
  WHERE brand = NEW.brand
    AND product_name = NEW.product_name
    AND unit_type = NEW.unit_type
    AND is_active = true
  LIMIT 1;
  
  IF conversion_rate IS NULL THEN
    conversion_rate := 1;
  END IF;
  
  NEW.tubes_equivalent := NEW.quantity * conversion_rate;
  
  RETURN NEW;
END;
$$;
