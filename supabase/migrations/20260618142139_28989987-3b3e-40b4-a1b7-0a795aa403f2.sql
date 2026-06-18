
-- B7.2: Low-stock signal — fan out to admins/owners + auto-fire on inventory drops

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
  v_meta jsonb;
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
  v_meta := jsonb_build_object(
    'product_id', p_product_id,
    'product_name', v_pname,
    'wholesaler_id', p_wholesaler_id,
    'wholesaler_name', v_wname,
    'quantity_available', v_inv.quantity_available,
    'threshold', v_threshold,
    'source', 'dd_check_low_stock'
  );

  -- Notify the wholesaler
  IF v_wuser IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (v_wuser, 'inventory_low_stock', v_title, v_msg, v_meta);
  END IF;

  -- Fan out to all admins and owners (so the signal surfaces in the admin console)
  FOR r IN
    SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','owner')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (r.user_id, 'inventory_low_stock', v_title, v_msg, v_meta);
  END LOOP;

  UPDATE public.marketplace_inventory
    SET last_low_stock_alert_at = now()
    WHERE product_id = p_product_id AND wholesaler_id = p_wholesaler_id;
END;
$function$;

-- Auto-fire whenever quantity_available drops (any pathway, not just RPC)
CREATE OR REPLACE FUNCTION public.trg_dd_check_low_stock_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only react to actual quantity changes to avoid recursion with last_low_stock_alert_at updates
  IF TG_OP = 'UPDATE' AND NEW.quantity_available IS NOT DISTINCT FROM OLD.quantity_available THEN
    RETURN NEW;
  END IF;

  PERFORM public.dd_check_low_stock(NEW.product_id, NEW.wholesaler_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'trg_dd_check_low_stock_on_change error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dd_check_low_stock_on_change ON public.marketplace_inventory;
CREATE TRIGGER trg_dd_check_low_stock_on_change
AFTER INSERT OR UPDATE OF quantity_available ON public.marketplace_inventory
FOR EACH ROW EXECUTE FUNCTION public.trg_dd_check_low_stock_on_change();
