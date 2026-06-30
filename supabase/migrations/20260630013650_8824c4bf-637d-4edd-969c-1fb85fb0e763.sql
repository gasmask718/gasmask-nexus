-- ============================================================
-- Dynasty Connect Campaign Infrastructure (Steps 1, 3, 4, 5)
-- Fix: dc_businesses.business_key is the referenced column.
-- ============================================================

-- ---------- Step 1: dc_campaign_schedules ----------
CREATE TABLE public.dc_campaign_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NULL REFERENCES public.dc_campaigns(id) ON DELETE CASCADE,
  business_unit_key text NULL REFERENCES public.dc_businesses(business_key) ON DELETE CASCADE,
  calling_hours_start time NOT NULL DEFAULT '09:00',
  calling_hours_end   time NOT NULL DEFAULT '20:00',
  timezone text NOT NULL DEFAULT 'America/New_York',
  days_of_week int[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::int[],
  max_calls_per_hour int NULL,
  max_concurrent_calls int NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dc_campaign_schedules_scope_chk
    CHECK (campaign_id IS NOT NULL OR business_unit_key IS NOT NULL)
);
CREATE INDEX idx_dc_campaign_schedules_campaign ON public.dc_campaign_schedules(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_dc_campaign_schedules_business ON public.dc_campaign_schedules(business_unit_key) WHERE business_unit_key IS NOT NULL;

GRANT SELECT ON public.dc_campaign_schedules TO authenticated;
GRANT ALL ON public.dc_campaign_schedules TO service_role;
ALTER TABLE public.dc_campaign_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dc_campaign_schedules_read_authenticated"
  ON public.dc_campaign_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "dc_campaign_schedules_admin_write"
  ON public.dc_campaign_schedules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- ---------- Step 3: kill_switch_state DC business-unit extension ----------
ALTER TABLE public.kill_switch_state
  ADD COLUMN IF NOT EXISTS business_unit_key text NULL;
CREATE INDEX IF NOT EXISTS idx_kill_switch_business_unit_key
  ON public.kill_switch_state(business_unit_key) WHERE business_unit_key IS NOT NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_kill_switch_active_campaign
  ON public.kill_switch_state(campaign_id) WHERE campaign_id IS NOT NULL AND is_active = true;


-- ---------- Step 4: dc_campaign_templates ----------
-- script_notes is FREE-FORM HUMAN GUIDANCE ONLY.
-- Actual prompts live on dc_agents.system_prompt / dc_agents.first_message.
CREATE TABLE public.dc_campaign_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  business_unit_key text NULL REFERENCES public.dc_businesses(business_key) ON DELETE SET NULL,
  description text NULL,
  default_agent_id uuid NULL REFERENCES public.dc_agents(id) ON DELETE SET NULL,
  default_schedule_id uuid NULL REFERENCES public.dc_campaign_schedules(id) ON DELETE SET NULL,
  script_notes text NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dc_campaign_templates_business ON public.dc_campaign_templates(business_unit_key);

GRANT SELECT ON public.dc_campaign_templates TO authenticated;
GRANT ALL ON public.dc_campaign_templates TO service_role;
ALTER TABLE public.dc_campaign_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dc_campaign_templates_read_authenticated"
  ON public.dc_campaign_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "dc_campaign_templates_admin_write"
  ON public.dc_campaign_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- ---------- Step 5: dc_lead_sync_log ----------
CREATE TABLE public.dc_lead_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit_key text NOT NULL,
  lead_id uuid NOT NULL,
  dc_lead_id uuid NULL REFERENCES public.dc_leads(id) ON DELETE SET NULL,
  sync_direction text NOT NULL CHECK (sync_direction IN ('in','out')),
  status_before text NULL,
  status_after  text NULL,
  sync_source text NOT NULL,
  success boolean NOT NULL DEFAULT true,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dc_lead_sync_log_lead   ON public.dc_lead_sync_log(business_unit_key, lead_id, created_at DESC);
CREATE INDEX idx_dc_lead_sync_log_source ON public.dc_lead_sync_log(sync_source, created_at DESC);
CREATE INDEX idx_dc_lead_sync_log_failed ON public.dc_lead_sync_log(success, created_at DESC) WHERE success = false;

GRANT SELECT ON public.dc_lead_sync_log TO authenticated;
GRANT ALL ON public.dc_lead_sync_log TO service_role;
ALTER TABLE public.dc_lead_sync_log ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user. Write: service_role only.
CREATE POLICY "dc_lead_sync_log_read_authenticated"
  ON public.dc_lead_sync_log FOR SELECT TO authenticated USING (true);
