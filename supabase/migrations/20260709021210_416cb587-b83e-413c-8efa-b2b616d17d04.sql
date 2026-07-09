CREATE OR REPLACE FUNCTION public.dc_call_logs_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dc_call_logs_touch_updated_at ON public.dc_call_logs;
CREATE TRIGGER trg_dc_call_logs_touch_updated_at
  BEFORE UPDATE ON public.dc_call_logs
  FOR EACH ROW EXECUTE FUNCTION public.dc_call_logs_touch_updated_at();