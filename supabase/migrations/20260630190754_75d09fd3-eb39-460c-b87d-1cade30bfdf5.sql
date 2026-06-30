
-- Step 5: UT post-call analysis surface

-- 1. New column on ut_partner_leads: ai_score_post_call
--    Separate from ai_score (pre-call qualification) so we can later evaluate
--    whether calling actually changes or confirms the pre-call assessment.
ALTER TABLE public.ut_partner_leads
  ADD COLUMN IF NOT EXISTS ai_score_post_call integer;

-- 2. Register lead table + enable sync in dc_businesses registry.
--    dc-post-call-analysis throws without this.
UPDATE public.dc_businesses
SET lead_table_name = 'ut_partner_leads', sync_enabled = true
WHERE business_key = 'unforgettable_times';

-- 3. ut_va_tasks — VA action queue, mirrors re_va_tasks shape exactly.
--    Post-call analysis inserts rows here for VA-flag actions
--    (send_onboarding_link, schedule_callback, etc.) — never auto-fires.
CREATE TABLE IF NOT EXISTS public.ut_va_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.ut_partner_leads(id) ON DELETE CASCADE,
  va_profile_id uuid,
  task_type text,             -- e.g. 'send_onboarding_link', 'seller_callback'
  action_type text,           -- e.g. 'send_onboarding_link' (matches RE convention)
  priority text DEFAULT 'normal',
  status text DEFAULT 'queued',
  notes text,
  script text,
  due_at timestamptz,
  completed_at timestamptz,
  escalated_to text,
  source_call_id text,        -- bland call_id that produced this task
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ut_va_tasks TO authenticated;
GRANT ALL ON public.ut_va_tasks TO service_role;

ALTER TABLE public.ut_va_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view UT VA tasks"
  ON public.ut_va_tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage UT VA tasks"
  ON public.ut_va_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ut_va_tasks_lead_id ON public.ut_va_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_ut_va_tasks_status ON public.ut_va_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ut_va_tasks_due_at ON public.ut_va_tasks(due_at);
