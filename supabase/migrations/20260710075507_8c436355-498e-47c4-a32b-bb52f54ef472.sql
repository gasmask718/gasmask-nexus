
-- ═══════════════════════════════════════════════════════════════════
-- Brandaro AI Receptionist — Part 1: Database
-- Two new tables: brandaro_receptionist_clients + brandaro_receptionist_calls
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────
-- brandaro_receptionist_clients
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brandaro_receptionist_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- LINKS
  qualified_lead_id uuid REFERENCES public.brandaro_qualified_leads(id),
  brandaro_client_id uuid REFERENCES public.brandaro_clients(id),

  -- BUSINESS INFO
  business_name text NOT NULL,
  owner_name text,
  phone text NOT NULL,
  email text NOT NULL,
  city text,
  state text,
  industry text,
  business_address text,
  business_website text,

  -- PRODUCT STATUS
  status text NOT NULL DEFAULT 'onboarding'
    CHECK (status IN ('onboarding','active','paused','trial','cancelled','suspended')),

  -- PLAN & PRICING
  plan text NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter','pro','enterprise')),
  setup_fee_amount numeric NOT NULL DEFAULT 497,
  monthly_amount numeric NOT NULL DEFAULT 197,
  setup_fee_paid boolean NOT NULL DEFAULT false,
  setup_fee_paid_at timestamptz,

  -- STRIPE
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_setup_intent_id text,
  next_billing_date date,
  trial_ends_at timestamptz,

  -- RETELL AI AGENT
  retell_agent_id text,
  retell_agent_name text DEFAULT 'Sara',
  retell_voice_id text,
  agent_provisioned boolean NOT NULL DEFAULT false,
  agent_provisioned_at timestamptz,

  -- TWILIO NUMBER
  twilio_phone_number text,
  twilio_number_sid text,
  number_provisioned boolean NOT NULL DEFAULT false,
  number_provisioned_at timestamptz,

  -- RECEPTIONIST CONFIGURATION
  receptionist_name text NOT NULL DEFAULT 'Sara',
  business_description text,
  services_offered text[],
  business_hours jsonb,
  timezone text NOT NULL DEFAULT 'America/New_York',
  faqs jsonb,
  call_script text,
  appointment_booking_enabled boolean NOT NULL DEFAULT true,
  appointment_calendar_url text,
  sms_followup_enabled boolean NOT NULL DEFAULT true,
  escalation_phone text,

  -- PERFORMANCE STATS
  total_calls_handled integer NOT NULL DEFAULT 0,
  calls_this_month integer NOT NULL DEFAULT 0,
  appointments_booked_total integer NOT NULL DEFAULT 0,
  appointments_booked_this_month integer NOT NULL DEFAULT 0,
  avg_call_duration_seconds integer NOT NULL DEFAULT 0,
  last_call_at timestamptz,

  -- LIFECYCLE
  onboarded_at timestamptz,
  activated_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brc_status_idx        ON public.brandaro_receptionist_clients(status);
CREATE INDEX IF NOT EXISTS brc_lead_idx          ON public.brandaro_receptionist_clients(qualified_lead_id);
CREATE INDEX IF NOT EXISTS brc_billing_idx       ON public.brandaro_receptionist_clients(next_billing_date);
CREATE INDEX IF NOT EXISTS brc_retell_agent_idx  ON public.brandaro_receptionist_clients(retell_agent_id);
CREATE INDEX IF NOT EXISTS brc_stripe_sub_idx    ON public.brandaro_receptionist_clients(stripe_subscription_id);

-- GRANTS (must precede RLS enablement per platform standard)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brandaro_receptionist_clients TO authenticated;
GRANT ALL ON public.brandaro_receptionist_clients TO service_role;

ALTER TABLE public.brandaro_receptionist_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY brc_service_all
  ON public.brandaro_receptionist_clients FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY brc_auth_read
  ON public.brandaro_receptionist_clients FOR SELECT
  TO authenticated USING (true);

-- Admins/owners can mutate from the dashboard
CREATE POLICY brc_admin_write
  ON public.brandaro_receptionist_clients FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- ───────────────────────────────────────────────
-- brandaro_receptionist_calls
-- ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.brandaro_receptionist_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.brandaro_receptionist_clients(id) ON DELETE CASCADE,

  -- CALL DETAILS
  caller_phone text,
  caller_name text,
  call_direction text NOT NULL DEFAULT 'inbound'
    CHECK (call_direction IN ('inbound','outbound')),
  call_duration_seconds integer NOT NULL DEFAULT 0,
  call_status text NOT NULL DEFAULT 'completed'
    CHECK (call_status IN ('completed','missed','voicemail','transferred','failed')),

  -- OUTCOME
  call_outcome text
    CHECK (call_outcome IN (
      'appointment_booked','info_provided','callback_requested',
      'transferred_to_human','voicemail_left','spam','wrong_number','other'
    )),
  appointment_booked boolean NOT NULL DEFAULT false,
  appointment_datetime timestamptz,
  appointment_service text,
  callback_requested boolean NOT NULL DEFAULT false,
  callback_datetime timestamptz,

  -- CONTENT
  transcript text,
  summary text,
  caller_sentiment text
    CHECK (caller_sentiment IN ('positive','neutral','negative','urgent')),
  key_info_extracted jsonb,

  -- RETELL
  retell_call_id text,
  recording_url text,

  -- SMS FOLLOWUP
  sms_followup_sent boolean NOT NULL DEFAULT false,
  sms_followup_sent_at timestamptz,
  sms_followup_content text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brca_client_idx        ON public.brandaro_receptionist_calls(client_id);
CREATE INDEX IF NOT EXISTS brca_date_idx          ON public.brandaro_receptionist_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS brca_outcome_idx       ON public.brandaro_receptionist_calls(call_outcome);
CREATE INDEX IF NOT EXISTS brca_booked_idx        ON public.brandaro_receptionist_calls(appointment_booked);
CREATE INDEX IF NOT EXISTS brca_retell_call_idx   ON public.brandaro_receptionist_calls(retell_call_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brandaro_receptionist_calls TO authenticated;
GRANT ALL ON public.brandaro_receptionist_calls TO service_role;

ALTER TABLE public.brandaro_receptionist_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY brca_service_all
  ON public.brandaro_receptionist_calls FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY brca_auth_read
  ON public.brandaro_receptionist_calls FOR SELECT
  TO authenticated USING (true);

CREATE POLICY brca_admin_write
  ON public.brandaro_receptionist_calls FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- ───────────────────────────────────────────────
-- updated_at trigger
-- ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.brandaro_receptionist_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS brc_touch_updated_at ON public.brandaro_receptionist_clients;
CREATE TRIGGER brc_touch_updated_at
  BEFORE UPDATE ON public.brandaro_receptionist_clients
  FOR EACH ROW EXECUTE FUNCTION public.brandaro_receptionist_touch_updated_at();
