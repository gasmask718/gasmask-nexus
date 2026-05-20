
-- Add cap column to ambassadors
ALTER TABLE public.ambassadors
  ADD COLUMN IF NOT EXISTS bulk_max_recipients integer NOT NULL DEFAULT 200;

-- Main bulk jobs table
CREATE TABLE IF NOT EXISTS public.ambassador_bulk_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('sms_blast', 'ai_call_blast')),
  template_id uuid REFERENCES public.ambassador_message_templates(id) ON DELETE SET NULL,
  script_id uuid REFERENCES public.ambassador_call_scripts(id) ON DELETE SET NULL,
  objective text,
  target_store_ids uuid[] NOT NULL,
  total_count integer NOT NULL,
  sent_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','paused','complete','failed','cancelled')),
  scheduled_for timestamptz,
  custom_variables jsonb,
  pacing_seconds integer NOT NULL DEFAULT 3,
  language_strategy text NOT NULL DEFAULT 'auto' CHECK (language_strategy IN ('auto','en','ar')),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_summary jsonb
);

CREATE INDEX IF NOT EXISTS idx_bulk_jobs_amb_status_created
  ON public.ambassador_bulk_jobs (ambassador_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_scheduled
  ON public.ambassador_bulk_jobs (scheduled_for)
  WHERE status = 'queued' AND scheduled_for IS NOT NULL;

-- Items table
CREATE TABLE IF NOT EXISTS public.ambassador_bulk_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.ambassador_bulk_jobs(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed','skipped','cancelled')),
  skip_reason text,
  message_id uuid,
  log_id uuid,
  error_message text,
  per_store_variables jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bulk_items_job_status
  ON public.ambassador_bulk_job_items (job_id, status);
CREATE INDEX IF NOT EXISTS idx_bulk_items_store
  ON public.ambassador_bulk_job_items (store_id, processed_at DESC);

-- RLS
ALTER TABLE public.ambassador_bulk_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_bulk_job_items ENABLE ROW LEVEL SECURITY;

-- Helper: is current user owner of this ambassador_id
CREATE OR REPLACE FUNCTION public.is_ambassador_owner(_ambassador_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ambassadors
    WHERE id = _ambassador_id AND user_id = auth.uid()
  )
$$;

-- Bulk Jobs Policies
DROP POLICY IF EXISTS "Ambassadors manage own bulk jobs" ON public.ambassador_bulk_jobs;
CREATE POLICY "Ambassadors manage own bulk jobs"
  ON public.ambassador_bulk_jobs
  FOR ALL
  TO authenticated
  USING (public.is_ambassador_owner(ambassador_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_ambassador_owner(ambassador_id) OR public.has_role(auth.uid(), 'admin'));

-- Bulk Job Items Policies (scope via parent job)
DROP POLICY IF EXISTS "Ambassadors manage own bulk job items" ON public.ambassador_bulk_job_items;
CREATE POLICY "Ambassadors manage own bulk job items"
  ON public.ambassador_bulk_job_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ambassador_bulk_jobs j
      WHERE j.id = job_id
      AND (public.is_ambassador_owner(j.ambassador_id) OR public.has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ambassador_bulk_jobs j
      WHERE j.id = job_id
      AND (public.is_ambassador_owner(j.ambassador_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- Realtime
ALTER TABLE public.ambassador_bulk_jobs REPLICA IDENTITY FULL;
ALTER TABLE public.ambassador_bulk_job_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ambassador_bulk_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ambassador_bulk_job_items;
