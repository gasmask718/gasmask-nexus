
-- 1. Extend communication_logs
ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bland_ai_handled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS twilio_sid text,
  ADD COLUMN IF NOT EXISTS transcription text,
  ADD COLUMN IF NOT EXISTS thread_id uuid;

-- 2. Create communication_threads
CREATE TABLE IF NOT EXISTS public.communication_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE,
  contact_id uuid,
  last_message_preview text,
  last_channel text,
  last_direction text,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  last_operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  unread_count integer NOT NULL DEFAULT 0,
  participating_operator_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_threads_store_id ON public.communication_threads(store_id);
CREATE INDEX IF NOT EXISTS idx_comm_threads_last_activity ON public.communication_threads(last_activity_at DESC);

-- 3. FK from logs.thread_id -> threads.id (after table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'communication_logs_thread_id_fkey'
  ) THEN
    ALTER TABLE public.communication_logs
      ADD CONSTRAINT communication_logs_thread_id_fkey
      FOREIGN KEY (thread_id) REFERENCES public.communication_threads(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Indexes on logs
CREATE INDEX IF NOT EXISTS idx_comm_logs_thread_id ON public.communication_logs(thread_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_store_id ON public.communication_logs(store_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_logs_twilio_sid ON public.communication_logs(twilio_sid) WHERE twilio_sid IS NOT NULL;

-- 5. Backfill operator_id from created_by where null
UPDATE public.communication_logs
SET operator_id = created_by
WHERE operator_id IS NULL AND created_by IS NOT NULL;

-- 6. Backfill threads from existing logs (one per distinct store_id)
INSERT INTO public.communication_threads (store_id, last_activity_at, last_operator_id, message_count, participating_operator_ids, contact_id, last_channel, last_direction, last_message_preview)
SELECT
  l.store_id,
  max(l.created_at) AS last_activity_at,
  (SELECT operator_id FROM public.communication_logs WHERE store_id = l.store_id ORDER BY created_at DESC LIMIT 1),
  count(*) AS message_count,
  COALESCE(array_agg(DISTINCT l.operator_id) FILTER (WHERE l.operator_id IS NOT NULL), '{}'::uuid[]),
  (SELECT contact_id FROM public.communication_logs WHERE store_id = l.store_id AND contact_id IS NOT NULL ORDER BY created_at DESC LIMIT 1),
  (SELECT channel FROM public.communication_logs WHERE store_id = l.store_id ORDER BY created_at DESC LIMIT 1),
  (SELECT direction FROM public.communication_logs WHERE store_id = l.store_id ORDER BY created_at DESC LIMIT 1),
  (SELECT COALESCE(message_content, summary) FROM public.communication_logs WHERE store_id = l.store_id ORDER BY created_at DESC LIMIT 1)
FROM public.communication_logs l
WHERE l.store_id IS NOT NULL
GROUP BY l.store_id
ON CONFLICT (store_id) DO NOTHING;

-- 7. Link logs to threads
UPDATE public.communication_logs l
SET thread_id = t.id
FROM public.communication_threads t
WHERE l.store_id = t.store_id AND l.thread_id IS NULL;

-- 8. Trigger function for thread sync
CREATE OR REPLACE FUNCTION public.sync_communication_thread()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id uuid;
BEGIN
  IF NEW.store_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.communication_threads (store_id, contact_id, last_activity_at, last_operator_id, last_channel, last_direction, last_message_preview, message_count, participating_operator_ids, unread_count)
  VALUES (
    NEW.store_id,
    NEW.contact_id,
    NEW.created_at,
    NEW.operator_id,
    NEW.channel,
    NEW.direction,
    COALESCE(NEW.message_content, NEW.summary),
    1,
    CASE WHEN NEW.operator_id IS NOT NULL THEN ARRAY[NEW.operator_id] ELSE '{}'::uuid[] END,
    CASE WHEN NEW.direction = 'inbound' THEN 1 ELSE 0 END
  )
  ON CONFLICT (store_id) DO UPDATE
  SET
    last_activity_at = EXCLUDED.last_activity_at,
    last_operator_id = COALESCE(EXCLUDED.last_operator_id, communication_threads.last_operator_id),
    last_channel = EXCLUDED.last_channel,
    last_direction = EXCLUDED.last_direction,
    last_message_preview = EXCLUDED.last_message_preview,
    contact_id = COALESCE(EXCLUDED.contact_id, communication_threads.contact_id),
    message_count = communication_threads.message_count + 1,
    participating_operator_ids = CASE
      WHEN NEW.operator_id IS NOT NULL AND NOT (NEW.operator_id = ANY(communication_threads.participating_operator_ids))
        THEN array_append(communication_threads.participating_operator_ids, NEW.operator_id)
      ELSE communication_threads.participating_operator_ids
    END,
    unread_count = CASE
      WHEN NEW.direction = 'inbound' THEN communication_threads.unread_count + 1
      ELSE communication_threads.unread_count
    END,
    updated_at = now()
  RETURNING id INTO v_thread_id;

  NEW.thread_id := v_thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_communication_logs_thread_sync ON public.communication_logs;
CREATE TRIGGER trg_communication_logs_thread_sync
BEFORE INSERT ON public.communication_logs
FOR EACH ROW
EXECUTE FUNCTION public.sync_communication_thread();

-- 9. RLS for communication_threads
ALTER TABLE public.communication_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comm_threads_select_operators ON public.communication_threads;
CREATE POLICY comm_threads_select_operators
  ON public.communication_threads FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'csr'::app_role)
    OR has_role(auth.uid(), 'ambassador'::app_role)
    OR has_role(auth.uid(), 'driver'::app_role)
    OR has_role(auth.uid(), 'biker'::app_role)
    OR has_role(auth.uid(), 'va'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
  );

DROP POLICY IF EXISTS comm_threads_update_operators ON public.communication_threads;
CREATE POLICY comm_threads_update_operators
  ON public.communication_threads FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'ambassador'::app_role)
    OR has_role(auth.uid(), 'driver'::app_role)
    OR has_role(auth.uid(), 'biker'::app_role)
  );

-- 10. RLS for communication_logs (ensure enabled and add scoped SELECT + INSERT)
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communication_logs_select_operators ON public.communication_logs;
CREATE POLICY communication_logs_select_operators
  ON public.communication_logs FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'owner'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'csr'::app_role)
    OR has_role(auth.uid(), 'ambassador'::app_role)
    OR has_role(auth.uid(), 'driver'::app_role)
    OR has_role(auth.uid(), 'biker'::app_role)
    OR has_role(auth.uid(), 'va'::app_role)
    OR has_role(auth.uid(), 'employee'::app_role)
  );

DROP POLICY IF EXISTS communication_logs_insert_operators ON public.communication_logs;
CREATE POLICY communication_logs_insert_operators
  ON public.communication_logs FOR INSERT TO authenticated
  WITH CHECK (
    operator_id = auth.uid()
    OR operator_id IS NULL
    OR bland_ai_handled = true
  );
