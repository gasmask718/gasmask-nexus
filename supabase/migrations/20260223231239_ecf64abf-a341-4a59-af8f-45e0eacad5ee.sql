
-- Fix security + typing for newly added Dual SMS Provider System tables (retry)

-- 1) comm_threads: add created_by and tighten RLS
ALTER TABLE public.comm_threads
  ADD COLUMN IF NOT EXISTS created_by uuid;

DROP POLICY IF EXISTS "Thread creator can insert" ON public.comm_threads;
DROP POLICY IF EXISTS "Thread creator/admin can update" ON public.comm_threads;
DROP POLICY IF EXISTS "Authenticated users can insert threads" ON public.comm_threads;
DROP POLICY IF EXISTS "Authenticated users can update threads" ON public.comm_threads;

CREATE POLICY "Thread creator can insert" ON public.comm_threads
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Thread creator/admin can update" ON public.comm_threads
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'va')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'va')
  );

-- 2) comm_provider_audit_log: tighten insert/select
DROP POLICY IF EXISTS "Admins can read audit log" ON public.comm_provider_audit_log;
DROP POLICY IF EXISTS "Admins can insert audit log" ON public.comm_provider_audit_log;
DROP POLICY IF EXISTS "Authenticated users can read audit log" ON public.comm_provider_audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON public.comm_provider_audit_log;

CREATE POLICY "Admins can read audit log" ON public.comm_provider_audit_log
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'va')
  );

CREATE POLICY "Admins can insert audit log" ON public.comm_provider_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'owner')
      OR public.has_role(auth.uid(), 'va')
    )
  );

-- 3) Fix trigger function search_path (avoid mutable search_path warning for our function)
DROP TRIGGER IF EXISTS trg_comm_threads_updated_at ON public.comm_threads;
DROP FUNCTION IF EXISTS public.update_comm_threads_updated_at();

CREATE OR REPLACE FUNCTION public.update_comm_threads_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_comm_threads_updated_at
  BEFORE UPDATE ON public.comm_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_comm_threads_updated_at();

-- 4) Use sms_provider enum where safe (drop defaults first)
ALTER TABLE public.comm_provider_settings
  ALTER COLUMN default_sms_provider DROP DEFAULT;

ALTER TABLE public.comm_provider_settings
  ALTER COLUMN default_sms_provider TYPE public.sms_provider
  USING (
    CASE
      WHEN default_sms_provider IN ('twilio','biztext') THEN default_sms_provider
      ELSE 'biztext'
    END
  )::public.sms_provider;

ALTER TABLE public.comm_provider_settings
  ALTER COLUMN default_sms_provider SET DEFAULT 'biztext'::public.sms_provider;

ALTER TABLE public.communication_messages
  ALTER COLUMN provider DROP DEFAULT;

ALTER TABLE public.communication_messages
  ALTER COLUMN provider TYPE public.sms_provider
  USING (
    CASE
      WHEN provider IS NULL THEN 'biztext'
      WHEN provider::text IN ('twilio','biztext') THEN provider::text
      ELSE 'biztext'
    END
  )::public.sms_provider;

ALTER TABLE public.communication_messages
  ALTER COLUMN provider SET DEFAULT 'biztext'::public.sms_provider;
