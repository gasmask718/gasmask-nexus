
-- ============================================================
-- PHASE 1: Ambassador Communications data layer
-- ============================================================

-- 1. Ambassadors: outbound Twilio number per ambassador
ALTER TABLE public.ambassadors
  ADD COLUMN IF NOT EXISTS twilio_number text;

-- 2. communication_messages: ambassador scoping + richer fields
ALTER TABLE public.communication_messages
  ADD COLUMN IF NOT EXISTS ambassador_id uuid REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS body_translated text;

CREATE INDEX IF NOT EXISTS idx_comm_messages_ambassador
  ON public.communication_messages(ambassador_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_messages_amb_store
  ON public.communication_messages(ambassador_id, store_id, created_at DESC);

-- 3. communication_logs: ambassador scoping + AI flag
ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS ambassador_id uuid REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_assisted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_comm_logs_ambassador
  ON public.communication_logs(ambassador_id, created_at DESC);

-- 4. ambassador_message_templates
CREATE TABLE IF NOT EXISTS public.ambassador_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  is_global boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'custom',
  body_en text NOT NULL DEFAULT '',
  body_ar text NOT NULL DEFAULT '',
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT amt_owner_or_global CHECK (is_global = true OR ambassador_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_amt_ambassador ON public.ambassador_message_templates(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_amt_category ON public.ambassador_message_templates(category);

ALTER TABLE public.ambassador_message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "amt_select_own_or_global" ON public.ambassador_message_templates;
CREATE POLICY "amt_select_own_or_global"
  ON public.ambassador_message_templates FOR SELECT
  USING (
    is_global = true
    OR ambassador_id = public.current_ambassador_id()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "amt_insert_own" ON public.ambassador_message_templates;
CREATE POLICY "amt_insert_own"
  ON public.ambassador_message_templates FOR INSERT
  WITH CHECK (
    (ambassador_id = public.current_ambassador_id() AND is_global = false)
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "amt_update_own" ON public.ambassador_message_templates;
CREATE POLICY "amt_update_own"
  ON public.ambassador_message_templates FOR UPDATE
  USING (
    ambassador_id = public.current_ambassador_id()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "amt_delete_own" ON public.ambassador_message_templates;
CREATE POLICY "amt_delete_own"
  ON public.ambassador_message_templates FOR DELETE
  USING (
    ambassador_id = public.current_ambassador_id()
    OR public.has_role(auth.uid(), 'admin')
  );

-- 5. ambassador_activity_log
CREATE TABLE IF NOT EXISTS public.ambassador_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  store_id uuid,
  action_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amb_activity_amb_created
  ON public.ambassador_activity_log(ambassador_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_amb_activity_store
  ON public.ambassador_activity_log(store_id);

ALTER TABLE public.ambassador_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aal_select_own" ON public.ambassador_activity_log;
CREATE POLICY "aal_select_own"
  ON public.ambassador_activity_log FOR SELECT
  USING (
    ambassador_id = public.current_ambassador_id()
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "aal_insert_own" ON public.ambassador_activity_log;
CREATE POLICY "aal_insert_own"
  ON public.ambassador_activity_log FOR INSERT
  WITH CHECK (
    ambassador_id = public.current_ambassador_id()
    OR public.has_role(auth.uid(), 'admin')
  );

-- 6. Additive ambassador-scope policies on communication_messages / logs
DROP POLICY IF EXISTS "cm_ambassador_select" ON public.communication_messages;
CREATE POLICY "cm_ambassador_select"
  ON public.communication_messages FOR SELECT
  USING (ambassador_id = public.current_ambassador_id());

DROP POLICY IF EXISTS "cm_ambassador_insert" ON public.communication_messages;
CREATE POLICY "cm_ambassador_insert"
  ON public.communication_messages FOR INSERT
  WITH CHECK (ambassador_id = public.current_ambassador_id());

DROP POLICY IF EXISTS "cm_ambassador_update" ON public.communication_messages;
CREATE POLICY "cm_ambassador_update"
  ON public.communication_messages FOR UPDATE
  USING (ambassador_id = public.current_ambassador_id());

DROP POLICY IF EXISTS "cl_ambassador_select" ON public.communication_logs;
CREATE POLICY "cl_ambassador_select"
  ON public.communication_logs FOR SELECT
  USING (ambassador_id = public.current_ambassador_id());

DROP POLICY IF EXISTS "cl_ambassador_insert" ON public.communication_logs;
CREATE POLICY "cl_ambassador_insert"
  ON public.communication_logs FOR INSERT
  WITH CHECK (ambassador_id = public.current_ambassador_id());

DROP POLICY IF EXISTS "cl_ambassador_update" ON public.communication_logs;
CREATE POLICY "cl_ambassador_update"
  ON public.communication_logs FOR UPDATE
  USING (ambassador_id = public.current_ambassador_id());

-- 7. Realtime
ALTER TABLE public.communication_messages REPLICA IDENTITY FULL;
ALTER TABLE public.communication_logs REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_messages';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_logs';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ambassador_activity_log';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 8. Storage bucket: ambassador-media
INSERT INTO storage.buckets (id, name, public)
VALUES ('ambassador-media', 'ambassador-media', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "amb_media_select_own" ON storage.objects;
CREATE POLICY "amb_media_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'ambassador-media'
    AND (
      public.current_ambassador_id()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "amb_media_insert_own" ON storage.objects;
CREATE POLICY "amb_media_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ambassador-media'
    AND public.current_ambassador_id()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "amb_media_delete_own" ON storage.objects;
CREATE POLICY "amb_media_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'ambassador-media'
    AND (
      public.current_ambassador_id()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- 9. updated_at trigger for templates
CREATE OR REPLACE FUNCTION public.amt_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_amt_updated_at ON public.ambassador_message_templates;
CREATE TRIGGER trg_amt_updated_at
  BEFORE UPDATE ON public.ambassador_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.amt_set_updated_at();
