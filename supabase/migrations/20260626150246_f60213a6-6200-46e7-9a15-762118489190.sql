
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.auto_skip_trace_on_re_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NULL
     AND COALESCE(NEW.skip_traced, false) = false
     AND COALESCE(NEW.status, '') <> 'dnc' THEN
    PERFORM net.http_post(
      url := 'https://qalaaroashbggynpvqct.supabase.co/functions/v1/re-skip-trace',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhbGFhcm9hc2hiZ2d5bnB2cWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NTI4MjAsImV4cCI6MjA3OTMyODgyMH0.agNLYbG5HnL0tUxalQtxffa5Z11J4gZSh9xzBHVMFMg'
      ),
      body := jsonb_build_object('lead_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_skip_trace_trigger ON public.re_leads;
CREATE TRIGGER auto_skip_trace_trigger
AFTER INSERT ON public.re_leads
FOR EACH ROW
EXECUTE FUNCTION public.auto_skip_trace_on_re_lead();
