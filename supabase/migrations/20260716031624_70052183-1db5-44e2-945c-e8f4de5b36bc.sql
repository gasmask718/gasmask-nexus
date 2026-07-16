
CREATE OR REPLACE FUNCTION public.products_all_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
BEGIN
  BEGIN
    v_actor := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.entity_audit_log
        (entity_type, entity_id, field_changed, old_value, new_value, edited_by)
      VALUES
        ('products_all', NEW.id, 'status',
         to_jsonb(OLD.status), to_jsonb(NEW.status), v_actor);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.entity_audit_log
      (entity_type, entity_id, field_changed, old_value, new_value, edited_by)
    VALUES
      ('products_all', OLD.id, '__row_deleted__',
       to_jsonb(OLD), NULL, v_actor);
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_all_audit ON public.products_all;
CREATE TRIGGER trg_products_all_audit
AFTER UPDATE OR DELETE ON public.products_all
FOR EACH ROW EXECUTE FUNCTION public.products_all_audit_trigger();
