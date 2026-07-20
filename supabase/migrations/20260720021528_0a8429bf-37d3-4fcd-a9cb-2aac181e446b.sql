
CREATE OR REPLACE FUNCTION public.enforce_skip_trace_on_missing_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_phone boolean := NEW.phone IS NOT NULL AND btrim(NEW.phone) <> '';
  has_email boolean := NEW.email IS NOT NULL AND btrim(NEW.email) <> '';
BEGIN
  -- Only mark skip_traced=true when real contact info actually exists.
  -- Missing phone/email means the row still NEEDS tracing, not that it has been traced.
  IF NOT has_phone AND NOT has_email THEN
    NEW.skip_traced := false;
    IF NEW.status IS NULL OR NEW.status IN ('new','queued') THEN
      NEW.status := 'skip_trace_pending';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Re-bind triggers so INSERT OR UPDATE of phone OR email both re-evaluate
DROP TRIGGER IF EXISTS trg_re_leads_skip_trace_guard ON public.re_leads;
CREATE TRIGGER trg_re_leads_skip_trace_guard
  BEFORE INSERT OR UPDATE OF phone, email ON public.re_leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_skip_trace_on_missing_phone();

DROP TRIGGER IF EXISTS trg_sf_leads_skip_trace_guard ON public.surplus_funds_leads;
CREATE TRIGGER trg_sf_leads_skip_trace_guard
  BEFORE INSERT OR UPDATE OF phone, email ON public.surplus_funds_leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_skip_trace_on_missing_phone();
