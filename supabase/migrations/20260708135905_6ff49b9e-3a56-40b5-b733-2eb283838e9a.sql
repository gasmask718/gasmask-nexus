CREATE OR REPLACE FUNCTION public.notify_clipper_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fn_url text := 'https://qalaaroashbggynpvqct.supabase.co/functions/v1/clipper-approved-email';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbGFhcm9hc2hiZ2d5bnB2cWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTI4MjAsImV4cCI6MjA3OTMyODgyMH0.agNLYbG5HnL0tUxalQtxffa5Z11J4gZSh9xzBHVMFMg';
BEGIN
  IF (TG_OP = 'UPDATE')
     AND COALESCE(OLD.status, '') <> 'active'
     AND NEW.status = 'active'
     AND NEW.email IS NOT NULL THEN
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
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