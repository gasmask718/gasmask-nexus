
-- Wave 1: Dual SMS Provider System

-- 1. Create enums
CREATE TYPE public.sms_provider AS ENUM ('twilio', 'biztext');
CREATE TYPE public.comm_message_status AS ENUM ('queued', 'sent', 'delivered', 'failed', 'undelivered');
CREATE TYPE public.comm_direction AS ENUM ('inbound', 'outbound');

-- 2. Add provider column to communication_messages (rename & extend approach)
ALTER TABLE public.communication_messages
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'biztext',
  ADD COLUMN IF NOT EXISTS from_number text,
  ADD COLUMN IF NOT EXISTS to_number text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS cost_amount numeric,
  ADD COLUMN IF NOT EXISTS thread_id uuid,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Unique index on provider_message_id where not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_messages_provider_msg_id 
  ON public.communication_messages(provider_message_id) WHERE provider_message_id IS NOT NULL;

-- Unique index on idempotency_key where not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_messages_idempotency 
  ON public.communication_messages(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 3. Create comm_threads table
CREATE TABLE IF NOT EXISTS public.comm_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL DEFAULT 'other',
  entity_id uuid,
  primary_phone text NOT NULL,
  last_message_at timestamptz DEFAULT now(),
  last_message_preview text,
  last_provider text,
  unread_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_threads_phone ON public.comm_threads(primary_phone);
CREATE INDEX IF NOT EXISTS idx_comm_threads_entity ON public.comm_threads(entity_type, entity_id);

-- Add thread_id FK
ALTER TABLE public.communication_messages
  ADD CONSTRAINT fk_comm_messages_thread 
  FOREIGN KEY (thread_id) REFERENCES public.comm_threads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_comm_messages_thread ON public.communication_messages(thread_id, created_at);

-- 4. Create comm_provider_settings table
CREATE TABLE IF NOT EXISTS public.comm_provider_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  default_sms_provider text NOT NULL DEFAULT 'biztext',
  twilio_messaging_service_sid text,
  biztext_account_id text DEFAULT '438',
  is_enabled_twilio boolean DEFAULT true,
  is_enabled_biztext boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id)
);

-- 5. Create comm_provider_audit_log table
CREATE TABLE IF NOT EXISTS public.comm_provider_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor_user_id uuid,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz DEFAULT now()
);

-- 6. Add sms opt-in fields to store_contacts if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_contacts' AND table_schema = 'public') THEN
    ALTER TABLE public.store_contacts 
      ADD COLUMN IF NOT EXISTS preferred_sms_provider text,
      ADD COLUMN IF NOT EXISTS sms_opt_in_status text DEFAULT 'unknown',
      ADD COLUMN IF NOT EXISTS sms_opt_in_source text,
      ADD COLUMN IF NOT EXISTS sms_opt_in_at timestamptz;
  END IF;
END $$;

-- 7. Enable RLS
ALTER TABLE public.comm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_provider_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read threads" ON public.comm_threads
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert threads" ON public.comm_threads
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update threads" ON public.comm_threads
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read provider settings" ON public.comm_provider_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage provider settings" ON public.comm_provider_settings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read audit log" ON public.comm_provider_audit_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert audit log" ON public.comm_provider_audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- 8. Enable realtime for threads
ALTER PUBLICATION supabase_realtime ADD TABLE public.comm_threads;

-- 9. Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_comm_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comm_threads_updated_at
  BEFORE UPDATE ON public.comm_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_comm_threads_updated_at();
