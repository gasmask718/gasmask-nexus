
CREATE OR REPLACE FUNCTION public.dd_check_low_stock(p_product_id uuid, p_wholesaler_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inv RECORD;
  v_wuser uuid;
  v_pname text;
  v_wname text;
  v_threshold integer;
  v_title text;
  v_msg text;
  v_url text;
  r record;
BEGIN
  SELECT * INTO v_inv FROM public.marketplace_inventory
    WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_threshold := COALESCE(v_inv.low_stock_threshold, v_inv.reorder_point, 10);
  IF v_inv.quantity_available > v_threshold THEN RETURN; END IF;

  IF v_inv.last_low_stock_alert_at IS NOT NULL
     AND v_inv.last_low_stock_alert_at > now() - interval '24 hours' THEN
    RETURN;
  END IF;

  SELECT user_id, company_name INTO v_wuser, v_wname
    FROM public.wholesaler_profiles WHERE id = p_wholesaler_id;
  SELECT product_name INTO v_pname FROM public.products_all WHERE id = p_product_id;

  v_title := CASE WHEN v_inv.quantity_available = 0 THEN 'Out of stock' ELSE 'Low stock alert' END;
  v_msg := COALESCE(v_pname,'(product)') || ' @ ' || COALESCE(v_wname,'(supplier)') ||
           ': ' || v_inv.quantity_available || ' units left (threshold ' || v_threshold || ')';
  v_url := '/dynasty-direct/inventory';

  IF v_wuser IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, entity_type, entity_id, action_url)
    VALUES (v_wuser, 'inventory_low_stock', v_title, v_msg, 'product', p_product_id, v_url);
  END IF;

  FOR r IN SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','owner') LOOP
    INSERT INTO public.notifications (user_id, type, title, message, entity_type, entity_id, action_url)
    VALUES (r.user_id, 'inventory_low_stock', v_title, v_msg, 'product', p_product_id, v_url);
  END LOOP;

  UPDATE public.marketplace_inventory
    SET last_low_stock_alert_at = now()
    WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id;
END;
$function$;
