
-- Phase 9: Ops Inbox tables, RLS, RPCs

CREATE TABLE public.ops_inbox_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'message' CHECK (type IN ('task','alert','message','system','campaign')),
  title text NOT NULL,
  entity_type text,
  entity_id text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','in_progress','resolved','closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  targeting jsonb DEFAULT '{}',
  metadata jsonb DEFAULT '{}'
);
CREATE INDEX idx_ops_inbox_threads_created ON public.ops_inbox_threads (created_at DESC);
CREATE INDEX idx_ops_inbox_threads_status ON public.ops_inbox_threads (status);
CREATE INDEX idx_ops_inbox_threads_entity ON public.ops_inbox_threads (entity_type, entity_id);

CREATE TABLE public.ops_inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.ops_inbox_threads(id) ON DELETE CASCADE,
  sender_user_id uuid,
  sender_type text NOT NULL DEFAULT 'system' CHECK (sender_type IN ('user','admin','system')),
  body text NOT NULL,
  attachments jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ops_inbox_messages_thread ON public.ops_inbox_messages (thread_id, created_at);

CREATE TABLE public.ops_inbox_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.ops_inbox_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  snoozed_until timestamptz,
  last_seen_message_at timestamptz,
  UNIQUE(thread_id, user_id)
);
CREATE INDEX idx_ops_inbox_recipients_user ON public.ops_inbox_recipients (user_id, read_at);

CREATE TABLE public.ops_inbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  actor_id uuid,
  thread_id uuid REFERENCES public.ops_inbox_threads(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ops_inbox_events_thread ON public.ops_inbox_events (thread_id, created_at);

ALTER TABLE public.ops_inbox_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_inbox_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_inbox_events ENABLE ROW LEVEL SECURITY;

-- Threads RLS
CREATE POLICY "Recipients can view their threads" ON public.ops_inbox_threads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_inbox_recipients r WHERE r.thread_id = id AND r.user_id = auth.uid()) OR created_by = auth.uid());

CREATE POLICY "Elevated can insert threads" ON public.ops_inbox_threads FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'va'));

CREATE POLICY "Elevated can update threads" ON public.ops_inbox_threads FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'va') OR created_by = auth.uid());

-- Messages RLS
CREATE POLICY "Recipients can view thread messages" ON public.ops_inbox_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_inbox_recipients r WHERE r.thread_id = ops_inbox_messages.thread_id AND r.user_id = auth.uid()) OR sender_user_id = auth.uid());

CREATE POLICY "Recipients can reply" ON public.ops_inbox_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.ops_inbox_recipients r WHERE r.thread_id = ops_inbox_messages.thread_id AND r.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- Recipients RLS
CREATE POLICY "Users view own recipients" ON public.ops_inbox_recipients FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Users update own state" ON public.ops_inbox_recipients FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Elevated insert recipients" ON public.ops_inbox_recipients FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'va'));

-- Events RLS
CREATE POLICY "Elevated view events" ON public.ops_inbox_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Auth insert events" ON public.ops_inbox_events FOR INSERT TO authenticated
  WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_inbox_recipients;

-- RPCs
CREATE OR REPLACE FUNCTION public.mark_ops_thread_read(p_thread_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE ops_inbox_recipients SET read_at = now(), last_seen_message_at = now()
  WHERE thread_id = p_thread_id AND user_id = auth.uid() AND read_at IS NULL;
  INSERT INTO ops_inbox_events (event_type, actor_id, thread_id) VALUES ('read', auth.uid(), p_thread_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.ack_ops_thread(p_thread_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE ops_inbox_recipients SET acknowledged_at = now(), read_at = COALESCE(read_at, now())
  WHERE thread_id = p_thread_id AND user_id = auth.uid();
  INSERT INTO ops_inbox_events (event_type, actor_id, thread_id) VALUES ('acknowledged', auth.uid(), p_thread_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_ops_thread(p_thread_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE ops_inbox_recipients SET resolved_at = now(), acknowledged_at = COALESCE(acknowledged_at, now()), read_at = COALESCE(read_at, now())
  WHERE thread_id = p_thread_id AND user_id = auth.uid();
  INSERT INTO ops_inbox_events (event_type, actor_id, thread_id) VALUES ('resolved', auth.uid(), p_thread_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.snooze_ops_thread(p_thread_id uuid, p_until timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE ops_inbox_recipients SET snoozed_until = p_until
  WHERE thread_id = p_thread_id AND user_id = auth.uid();
  INSERT INTO ops_inbox_events (event_type, actor_id, thread_id, metadata) VALUES ('snoozed', auth.uid(), p_thread_id, jsonb_build_object('until', p_until));
END;
$$;
