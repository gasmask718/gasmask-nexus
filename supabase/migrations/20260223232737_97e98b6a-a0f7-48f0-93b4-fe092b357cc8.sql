
-- PHASE 1: Database Hardening for Dual SMS Router

-- 1. Ensure sms_provider enum exists (skip if already exists)
DO $$ BEGIN
  CREATE TYPE public.sms_provider AS ENUM ('twilio', 'biztext');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Create outbound_messages table
CREATE TABLE IF NOT EXISTS public.outbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text UNIQUE NOT NULL,
  store_id uuid NULL,
  to_number text NOT NULL,
  message_body text NOT NULL,
  provider public.sms_provider NOT NULL,
  provider_message_id text NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','blocked')),
  error_code text NULL,
  error_message text NULL,
  campaign_id uuid NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  message_hash text NULL,
  created_by uuid NULL,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_outbound_messages_to_number ON public.outbound_messages(to_number);
CREATE INDEX IF NOT EXISTS idx_outbound_messages_created_at ON public.outbound_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_outbound_messages_status ON public.outbound_messages(status);

ALTER TABLE public.outbound_messages ENABLE ROW LEVEL SECURITY;

-- RLS: admins see all, users see own
DROP POLICY IF EXISTS "Admins can view all outbound" ON public.outbound_messages;
CREATE POLICY "Admins can view all outbound" ON public.outbound_messages
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'va')
  );

DROP POLICY IF EXISTS "Users can view own outbound" ON public.outbound_messages;
CREATE POLICY "Users can view own outbound" ON public.outbound_messages
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Service can insert outbound" ON public.outbound_messages;
CREATE POLICY "Service can insert outbound" ON public.outbound_messages
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update outbound" ON public.outbound_messages;
CREATE POLICY "Service can update outbound" ON public.outbound_messages
  FOR UPDATE TO authenticated
  USING (true);

-- 3. Create opt_out_events table
CREATE TABLE IF NOT EXISTS public.opt_out_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  source text NULL,
  reason text NULL,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_opt_out_phone ON public.opt_out_events(phone_number);

ALTER TABLE public.opt_out_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage opt outs" ON public.opt_out_events;
CREATE POLICY "Admins can manage opt outs" ON public.opt_out_events
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'va')
  );

-- 4. Create messaging_settings table
CREATE TABLE IF NOT EXISTS public.messaging_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_sms_provider public.sms_provider NOT NULL DEFAULT 'biztext'::public.sms_provider,
  fallback_provider public.sms_provider NULL,
  daily_send_limit integer DEFAULT 1000,
  per_number_cooldown_minutes integer DEFAULT 60,
  allow_marketing_sms boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.messaging_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage settings" ON public.messaging_settings;
CREATE POLICY "Admins can manage settings" ON public.messaging_settings
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
  );

DROP POLICY IF EXISTS "Authenticated can read settings" ON public.messaging_settings;
CREATE POLICY "Authenticated can read settings" ON public.messaging_settings
  FOR SELECT TO authenticated
  USING (true);

-- Insert default settings row
INSERT INTO public.messaging_settings (default_sms_provider, fallback_provider, daily_send_limit, per_number_cooldown_minutes, allow_marketing_sms)
VALUES ('biztext'::public.sms_provider, 'twilio'::public.sms_provider, 1000, 60, false)
ON CONFLICT DO NOTHING;

-- 5. Prevent DELETE on outbound_messages (audit integrity)
CREATE OR REPLACE FUNCTION public.prevent_outbound_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Deleting outbound messages is prohibited for audit integrity';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_outbound_delete ON public.outbound_messages;
CREATE TRIGGER trg_prevent_outbound_delete
  BEFORE DELETE ON public.outbound_messages
  FOR EACH ROW EXECUTE FUNCTION public.prevent_outbound_delete();

-- 6. Prevent message_body overwrite (audit integrity)
CREATE OR REPLACE FUNCTION public.prevent_body_overwrite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.message_body IS DISTINCT FROM NEW.message_body THEN
    RAISE EXCEPTION 'Overwriting message_body is prohibited for audit integrity';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_body_overwrite ON public.outbound_messages;
CREATE TRIGGER trg_prevent_body_overwrite
  BEFORE UPDATE ON public.outbound_messages
  FOR EACH ROW EXECUTE FUNCTION public.prevent_body_overwrite();
