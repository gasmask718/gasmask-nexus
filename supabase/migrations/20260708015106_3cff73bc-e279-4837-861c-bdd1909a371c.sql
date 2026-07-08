
-- Auto-price trigger: fires dd-auto-price via pg_net on insert / supplier_cost change
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_dd_auto_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url text := 'https://qalaaroashbggynpvqct.supabase.co/functions/v1/dd-auto-price';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbGFhcm9hc2hiZ2d5bnB2cWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTI4MjAsImV4cCI6MjA3OTMyODgyMH0.agNLYbG5HnL0tUxalQtxffa5Z11J4gZSh9xzBHVMFMg';
BEGIN
  -- Only fire when we have the inputs auto-price needs
  IF NEW.supplier_cost IS NULL OR NEW.supplier_cost <= 0 OR NEW.category IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object('product_id', NEW.id, 'persist', true)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_all_auto_price_ins ON public.products_all;
CREATE TRIGGER products_all_auto_price_ins
AFTER INSERT ON public.products_all
FOR EACH ROW
EXECUTE FUNCTION public.trigger_dd_auto_price();

DROP TRIGGER IF EXISTS products_all_auto_price_upd ON public.products_all;
CREATE TRIGGER products_all_auto_price_upd
AFTER UPDATE OF supplier_cost ON public.products_all
FOR EACH ROW
WHEN (NEW.supplier_cost IS DISTINCT FROM OLD.supplier_cost)
EXECUTE FUNCTION public.trigger_dd_auto_price();
