
-- Phase 10A: Task Formalization (Read-Only Ops Layer)

CREATE TYPE public.ops_task_type AS ENUM ('visit', 'delivery', 'follow_up', 'call', 'audit', 'review', 'other');
CREATE TYPE public.ops_task_priority AS ENUM ('low', 'normal', 'high', 'critical');
CREATE TYPE public.ops_task_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.ops_task_event_type AS ENUM ('created', 'status_changed', 'completed', 'reopened', 'cancelled');

CREATE TABLE public.ops_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES public.ops_inbox_threads(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  task_type public.ops_task_type NOT NULL DEFAULT 'other',
  priority public.ops_task_priority NOT NULL DEFAULT 'normal',
  expected_role text,
  expected_actor_id uuid,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  status public.ops_task_status NOT NULL DEFAULT 'open',
  completed_at timestamptz,
  completed_by uuid
);

CREATE INDEX idx_ops_tasks_thread ON public.ops_tasks(thread_id);
CREATE INDEX idx_ops_tasks_status ON public.ops_tasks(status);
CREATE INDEX idx_ops_tasks_created ON public.ops_tasks(created_at DESC);
CREATE INDEX idx_ops_tasks_role ON public.ops_tasks(expected_role);

CREATE TABLE public.ops_task_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.ops_tasks(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  event_type public.ops_task_event_type NOT NULL,
  previous_status public.ops_task_status,
  new_status public.ops_task_status,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ops_task_events_task ON public.ops_task_events(task_id, created_at);

ALTER TABLE public.ops_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_task_events ENABLE ROW LEVEL SECURITY;

-- RLS policies (admin only, no super_admin)
CREATE POLICY "Users can view tasks for their threads"
  ON public.ops_tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ops_inbox_recipients r
      WHERE r.thread_id = ops_tasks.thread_id AND r.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can insert tasks"
  ON public.ops_tasks FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authorized users can update tasks"
  ON public.ops_tasks FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can view task events for visible tasks"
  ON public.ops_task_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ops_tasks t
      JOIN public.ops_inbox_recipients r ON r.thread_id = t.thread_id
      WHERE t.id = ops_task_events.task_id AND r.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Authenticated users can insert own task events"
  ON public.ops_task_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- RPCs
CREATE OR REPLACE FUNCTION public.create_ops_task(
  p_thread_id uuid,
  p_title text,
  p_description text DEFAULT NULL,
  p_task_type public.ops_task_type DEFAULT 'other',
  p_priority public.ops_task_priority DEFAULT 'normal',
  p_expected_role text DEFAULT NULL,
  p_expected_actor_id uuid DEFAULT NULL,
  p_due_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_task_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF NOT has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  IF p_thread_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ops_inbox_threads WHERE id = p_thread_id) THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;
  IF p_thread_id IS NOT NULL AND EXISTS (SELECT 1 FROM ops_tasks WHERE thread_id = p_thread_id) THEN
    RAISE EXCEPTION 'Task already exists for this thread';
  END IF;

  INSERT INTO ops_tasks (thread_id, title, description, task_type, priority, expected_role, expected_actor_id, due_at, created_by)
  VALUES (p_thread_id, p_title, p_description, p_task_type, p_priority, p_expected_role, p_expected_actor_id, p_due_at, v_uid)
  RETURNING id INTO v_task_id;

  INSERT INTO ops_task_events (task_id, actor_id, event_type, new_status)
  VALUES (v_task_id, v_uid, 'created', 'open');

  RETURN v_task_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_ops_task_status(
  p_task_id uuid,
  p_new_status public.ops_task_status
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old_status ops_task_status;
  v_task RECORD;
BEGIN
  SELECT * INTO v_task FROM ops_tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found'; END IF;
  v_old_status := v_task.status;

  IF NOT (has_role(v_uid, 'admin') OR v_task.created_by = v_uid OR v_task.expected_actor_id = v_uid) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE ops_tasks SET
    status = p_new_status,
    completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE completed_at END,
    completed_by = CASE WHEN p_new_status = 'completed' THEN v_uid ELSE completed_by END
  WHERE id = p_task_id;

  INSERT INTO ops_task_events (task_id, actor_id, event_type, previous_status, new_status)
  VALUES (p_task_id, v_uid,
    CASE
      WHEN p_new_status = 'completed' THEN 'completed'::ops_task_event_type
      WHEN p_new_status = 'cancelled' THEN 'cancelled'::ops_task_event_type
      WHEN p_new_status = 'open' AND v_old_status = 'completed' THEN 'reopened'::ops_task_event_type
      ELSE 'status_changed'::ops_task_event_type
    END,
    v_old_status, p_new_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_ops_task(p_task_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM update_ops_task_status(p_task_id, 'completed'); END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_ops_task(p_task_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM update_ops_task_status(p_task_id, 'open'); END;
$$;
