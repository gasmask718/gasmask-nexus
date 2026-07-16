
-- 1. sf_callback_tasks
CREATE TABLE IF NOT EXISTS public.sf_callback_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.surplus_funds_leads(id) ON DELETE CASCADE,
  task_type text,
  priority text,
  status text NOT NULL DEFAULT 'queued',
  script text,
  notes text,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sf_callback_tasks TO authenticated;
GRANT ALL ON public.sf_callback_tasks TO service_role;

ALTER TABLE public.sf_callback_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sf_callback_tasks"
  ON public.sf_callback_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sf_callback_tasks"
  ON public.sf_callback_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update sf_callback_tasks"
  ON public.sf_callback_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete sf_callback_tasks"
  ON public.sf_callback_tasks FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_sf_callback_tasks_lead ON public.sf_callback_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_sf_callback_tasks_status_due ON public.sf_callback_tasks(status, due_at);

-- 2. Auto-skip-trace guard for re_leads / surplus_funds_leads
CREATE OR REPLACE FUNCTION public.enforce_skip_trace_on_missing_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
    NEW.skip_traced := true;
    IF NEW.status IS NULL OR NEW.status IN ('new','queued') THEN
      NEW.status := 'skip_trace_pending';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_re_leads_skip_trace_guard ON public.re_leads;
CREATE TRIGGER trg_re_leads_skip_trace_guard
  BEFORE INSERT OR UPDATE OF phone ON public.re_leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_skip_trace_on_missing_phone();

DROP TRIGGER IF EXISTS trg_sf_leads_skip_trace_guard ON public.surplus_funds_leads;
CREATE TRIGGER trg_sf_leads_skip_trace_guard
  BEFORE INSERT OR UPDATE OF phone ON public.surplus_funds_leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_skip_trace_on_missing_phone();

-- 3. Dialer queue guard
CREATE OR REPLACE FUNCTION public.block_dc_leads_without_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dc_leads_require_phone ON public.dc_leads;
CREATE TRIGGER trg_dc_leads_require_phone
  BEFORE INSERT ON public.dc_leads
  FOR EACH ROW EXECUTE FUNCTION public.block_dc_leads_without_phone();

-- 4. Backfill
UPDATE public.re_leads
   SET skip_traced = true,
       status = CASE WHEN status IN ('new','queued') THEN 'skip_trace_pending' ELSE status END
 WHERE (phone IS NULL OR btrim(phone) = '')
   AND COALESCE(skip_traced, false) = false;

UPDATE public.surplus_funds_leads
   SET skip_traced = true,
       status = CASE WHEN status IN ('new','queued') THEN 'skip_trace_pending' ELSE status END
 WHERE (phone IS NULL OR btrim(phone) = '')
   AND COALESCE(skip_traced, false) = false;
