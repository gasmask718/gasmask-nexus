CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_clipper_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF (TG_OP = 'UPDATE')
     AND COALESCE(OLD.status, '') <> 'active'
     AND NEW.status = 'active'
     AND NEW.email IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://qalaaroashbggynpvqct.supabase.co/functions/v1/clipper-approved-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(current_setting('app.service_role_key', true), '')
      ),
      body := jsonb_build_object(
        'clipper_id', NEW.id,
        'full_name', NEW.full_name,
        'email', NEW.email
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_clipper_approved ON public.clipper_accounts;

CREATE TRIGGER after_clipper_approved
  AFTER UPDATE ON public.clipper_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_clipper_approved();