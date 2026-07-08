
CREATE OR REPLACE FUNCTION public.trigger_dd_generate_description()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_url := NULL;
  END;
  IF v_url IS NULL THEN
    v_url := current_setting('app.supabase_url', true);
  END IF;
  IF v_url IS NULL OR v_url = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/dd-generate-description',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('product_id', NEW.id, 'persist', true)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_all_auto_description_ins ON public.products_all;
CREATE TRIGGER products_all_auto_description_ins
AFTER INSERT ON public.products_all
FOR EACH ROW
EXECUTE FUNCTION public.trigger_dd_generate_description();

DROP TRIGGER IF EXISTS products_all_auto_description_upd ON public.products_all;
CREATE TRIGGER products_all_auto_description_upd
AFTER UPDATE OF product_name, category ON public.products_all
FOR EACH ROW
WHEN (NEW.product_name IS DISTINCT FROM OLD.product_name OR NEW.category IS DISTINCT FROM OLD.category)
EXECUTE FUNCTION public.trigger_dd_generate_description();
