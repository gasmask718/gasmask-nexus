-- ============ Application Automation Engine (execution layer) ============
-- Funding Hub remains the system of record. Nothing here duplicates clients,
-- businesses, lenders, applications, approvals or funding.

CREATE OR REPLACE FUNCTION public.is_funding_operator()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('owner'::app_role,'admin'::app_role,'employee'::app_role,'accountant'::app_role)
  )
$$;

-- ---------- 1. lender_automation_config ----------
CREATE TABLE public.lender_automation_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id uuid REFERENCES public.funding_lender_database(id) ON DELETE CASCADE,
  lender_name text NOT NULL,
  submission_method text NOT NULL DEFAULT 'manual'
    CHECK (submission_method IN ('api','browser','manual')),
  api_enabled boolean NOT NULL DEFAULT false,
  browser_enabled boolean NOT NULL DEFAULT false,
  manual_enabled boolean NOT NULL DEFAULT true,
  application_url text,
  api_base_url text,
  api_secret_name text,
  adapter_key text NOT NULL DEFAULT 'manual',
  automation_authorized boolean NOT NULL DEFAULT false,
  authorization_note text,
  requires_human_verification boolean NOT NULL DEFAULT true,
  requires_otp boolean NOT NULL DEFAULT false,
  requires_identity_verification boolean NOT NULL DEFAULT false,
  requires_signature boolean NOT NULL DEFAULT false,
  requires_final_certification boolean NOT NULL DEFAULT true,
  max_attempts integer NOT NULL DEFAULT 3,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lender_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lender_automation_config TO authenticated;
GRANT ALL ON public.lender_automation_config TO service_role;
ALTER TABLE public.lender_automation_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operators manage lender automation config"
  ON public.lender_automation_config FOR ALL TO authenticated
  USING (public.is_funding_operator()) WITH CHECK (public.is_funding_operator());

-- ---------- 2. automation_jobs ----------
CREATE TABLE public.automation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.funding_applications(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.funding_clients(id) ON DELETE SET NULL,
  lender_id uuid REFERENCES public.funding_lender_database(id) ON DELETE SET NULL,
  lender_name text,
  adapter_key text NOT NULL DEFAULT 'manual',
  submission_method text NOT NULL CHECK (submission_method IN ('api','browser','manual')),
  status text NOT NULL DEFAULT 'CREATED' CHECK (status IN (
    'CREATED','QUEUED','STARTING','RUNNING','FORM_DETECTED','FILLING','DOCUMENT_UPLOAD',
    'HUMAN_CHECKPOINT','READY_TO_SUBMIT','SUBMITTING','READING_RESPONSE','COMPLETED',
    'FAILED','BLOCKED','NEEDS_INFORMATION','NEEDS_HUMAN_REVIEW','CANCELLED'
  )),
  current_step text,
  priority integer NOT NULL DEFAULT 5,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  requires_human_action boolean NOT NULL DEFAULT false,
  human_action_type text,
  missing_fields text[] NOT NULL DEFAULT '{}',
  failure_reason text,
  failure_class text CHECK (failure_class IS NULL OR failure_class IN (
    'NETWORK_ERROR','API_TIMEOUT','BROWSER_CRASH','CAPTCHA','BOT_BLOCK',
    'INVALID_CLIENT_DATA','IDENTITY_VERIFICATION','FINAL_CERTIFICATION',
    'MISSING_DOCUMENT','LENDER_ERROR','UNKNOWN'
  )),
  -- normalized result (never fabricated)
  result_status text CHECK (result_status IS NULL OR result_status IN (
    'SUBMITTED','PENDING','APPROVED','DECLINED','NEEDS_DOCUMENTS','NEEDS_HUMAN_REVIEW','FAILED','UNKNOWN'
  )),
  lender_reference text,
  approved_amount numeric,
  requested_amount numeric,
  next_action text,
  decision_date date,
  raw_response jsonb,
  submission_confirmed boolean NOT NULL DEFAULT false,
  idempotency_key text NOT NULL,
  queued_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  last_event_at timestamptz,
  worker_id text,
  lease_expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key)
);
CREATE INDEX idx_automation_jobs_app ON public.automation_jobs(application_id);
CREATE INDEX idx_automation_jobs_status ON public.automation_jobs(status);
CREATE UNIQUE INDEX idx_automation_jobs_one_open_per_app
  ON public.automation_jobs(application_id)
  WHERE status NOT IN ('COMPLETED','FAILED','CANCELLED');
GRANT SELECT, INSERT, UPDATE ON public.automation_jobs TO authenticated;
GRANT ALL ON public.automation_jobs TO service_role;
ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operators read automation jobs"
  ON public.automation_jobs FOR SELECT TO authenticated USING (public.is_funding_operator());
CREATE POLICY "operators create automation jobs"
  ON public.automation_jobs FOR INSERT TO authenticated WITH CHECK (public.is_funding_operator());
CREATE POLICY "operators update automation jobs"
  ON public.automation_jobs FOR UPDATE TO authenticated
  USING (public.is_funding_operator()) WITH CHECK (public.is_funding_operator());

-- ---------- 3. automation_events ----------
CREATE TABLE public.automation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_job_id uuid NOT NULL REFERENCES public.automation_jobs(id) ON DELETE CASCADE,
  application_id uuid,
  event_type text NOT NULL,
  message text,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info','warn','error')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_automation_events_job ON public.automation_events(automation_job_id, created_at DESC);
GRANT SELECT, INSERT ON public.automation_events TO authenticated;
GRANT ALL ON public.automation_events TO service_role;
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operators read automation events"
  ON public.automation_events FOR SELECT TO authenticated USING (public.is_funding_operator());
CREATE POLICY "operators write automation events"
  ON public.automation_events FOR INSERT TO authenticated WITH CHECK (public.is_funding_operator());

-- ---------- 4. automation_checkpoints ----------
CREATE TABLE public.automation_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_job_id uuid NOT NULL REFERENCES public.automation_jobs(id) ON DELETE CASCADE,
  checkpoint_type text NOT NULL CHECK (checkpoint_type IN (
    'OTP','SMS_VERIFICATION','EMAIL_VERIFICATION','IDENTITY_VERIFICATION','SELFIE_VERIFICATION',
    'E_SIGNATURE','CERTIFICATION','FINAL_ACCURACY_CONFIRMATION','CAPTCHA','BOT_BLOCK','AMBIGUOUS_RESPONSE'
  )),
  reason text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','ABANDONED')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  completed_by uuid,
  completion_note text,
  automation_resumed boolean NOT NULL DEFAULT false,
  resumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_automation_checkpoints_job ON public.automation_checkpoints(automation_job_id);
GRANT SELECT, INSERT, UPDATE ON public.automation_checkpoints TO authenticated;
GRANT ALL ON public.automation_checkpoints TO service_role;
ALTER TABLE public.automation_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operators manage automation checkpoints"
  ON public.automation_checkpoints FOR ALL TO authenticated
  USING (public.is_funding_operator()) WITH CHECK (public.is_funding_operator());

-- ---------- 5. automation_field_mappings ----------
CREATE TABLE public.automation_field_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_config_id uuid NOT NULL REFERENCES public.lender_automation_config(id) ON DELETE CASCADE,
  lender_field_label text NOT NULL,
  lender_selector text,
  field_kind text NOT NULL DEFAULT 'text'
    CHECK (field_kind IN ('text','number','currency','date','email','phone','select','checkbox','radio','file')),
  canonical_field text NOT NULL,
  transform text,
  allowed_values text[],
  required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lender_config_id, lender_field_label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_field_mappings TO authenticated;
GRANT ALL ON public.automation_field_mappings TO service_role;
ALTER TABLE public.automation_field_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operators manage automation field mappings"
  ON public.automation_field_mappings FOR ALL TO authenticated
  USING (public.is_funding_operator()) WITH CHECK (public.is_funding_operator());

-- ---------- state machine enforcement ----------
CREATE OR REPLACE FUNCTION public.automation_job_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  allowed text[];
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    allowed := CASE OLD.status
      WHEN 'CREATED'           THEN ARRAY['QUEUED','CANCELLED','NEEDS_INFORMATION','FAILED']
      WHEN 'QUEUED'            THEN ARRAY['STARTING','CANCELLED','NEEDS_INFORMATION','FAILED','BLOCKED']
      WHEN 'STARTING'          THEN ARRAY['RUNNING','FAILED','BLOCKED','CANCELLED','NEEDS_HUMAN_REVIEW']
      WHEN 'RUNNING'           THEN ARRAY['FORM_DETECTED','SUBMITTING','READING_RESPONSE','HUMAN_CHECKPOINT','FAILED','BLOCKED','NEEDS_INFORMATION','NEEDS_HUMAN_REVIEW','CANCELLED']
      WHEN 'FORM_DETECTED'     THEN ARRAY['FILLING','NEEDS_INFORMATION','FAILED','BLOCKED','NEEDS_HUMAN_REVIEW','CANCELLED']
      WHEN 'FILLING'           THEN ARRAY['DOCUMENT_UPLOAD','HUMAN_CHECKPOINT','READY_TO_SUBMIT','NEEDS_INFORMATION','FAILED','BLOCKED','NEEDS_HUMAN_REVIEW','CANCELLED']
      WHEN 'DOCUMENT_UPLOAD'   THEN ARRAY['HUMAN_CHECKPOINT','READY_TO_SUBMIT','NEEDS_INFORMATION','FAILED','BLOCKED','NEEDS_HUMAN_REVIEW','CANCELLED']
      WHEN 'HUMAN_CHECKPOINT'  THEN ARRAY['FILLING','DOCUMENT_UPLOAD','READY_TO_SUBMIT','SUBMITTING','NEEDS_HUMAN_REVIEW','FAILED','BLOCKED','CANCELLED']
      WHEN 'READY_TO_SUBMIT'   THEN ARRAY['SUBMITTING','HUMAN_CHECKPOINT','CANCELLED','FAILED','NEEDS_HUMAN_REVIEW']
      WHEN 'SUBMITTING'        THEN ARRAY['READING_RESPONSE','NEEDS_HUMAN_REVIEW','FAILED','BLOCKED']
      WHEN 'READING_RESPONSE'  THEN ARRAY['COMPLETED','NEEDS_HUMAN_REVIEW','FAILED']
      WHEN 'NEEDS_INFORMATION' THEN ARRAY['QUEUED','CANCELLED','FAILED']
      WHEN 'NEEDS_HUMAN_REVIEW'THEN ARRAY['QUEUED','COMPLETED','CANCELLED','FAILED']
      WHEN 'BLOCKED'           THEN ARRAY['NEEDS_HUMAN_REVIEW','CANCELLED','FAILED']
      WHEN 'FAILED'            THEN ARRAY['QUEUED','CANCELLED']
      ELSE ARRAY[]::text[]  -- COMPLETED and CANCELLED are terminal
    END;
    IF NOT (NEW.status = ANY(allowed)) THEN
      RAISE EXCEPTION 'Invalid automation job transition: % -> %', OLD.status, NEW.status;
    END IF;
    NEW.last_event_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_automation_job_guard
  BEFORE INSERT OR UPDATE ON public.automation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.automation_job_guard();

CREATE OR REPLACE FUNCTION public.automation_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_lac_touch BEFORE UPDATE ON public.lender_automation_config
  FOR EACH ROW EXECUTE FUNCTION public.automation_touch_updated_at();
CREATE TRIGGER trg_acp_touch BEFORE UPDATE ON public.automation_checkpoints
  FOR EACH ROW EXECUTE FUNCTION public.automation_touch_updated_at();
CREATE TRIGGER trg_afm_touch BEFORE UPDATE ON public.automation_field_mappings
  FOR EACH ROW EXECUTE FUNCTION public.automation_touch_updated_at();
