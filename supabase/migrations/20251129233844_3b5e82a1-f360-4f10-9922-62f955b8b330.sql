-- Create message_threads table
CREATE TABLE public.message_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_type TEXT NOT NULL DEFAULT 'general',
  participants JSONB NOT NULL DEFAULT '[]',
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  subject TEXT,
  order_id UUID,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL,
  receiver_id UUID,
  receiver_role TEXT,
  message_text TEXT NOT NULL,
  translated_text JSONB DEFAULT '{}',
  attachments JSONB DEFAULT '[]',
  read_by UUID[] DEFAULT '{}',
  is_system_message BOOLEAN DEFAULT false,
  is_whisper BOOLEAN DEFAULT false,
  starred_by UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create automated_notifications table
CREATE TABLE public.automated_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_text TEXT NOT NULL,
  generated_by TEXT NOT NULL DEFAULT 'System',
  target_role TEXT,
  target_user_id UUID,
  related_entity_type TEXT,
  related_entity_id UUID,
  status TEXT DEFAULT 'pending',
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automated_notifications ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policies for message_threads
CREATE POLICY "Users can view threads they participate in"
ON public.message_threads FOR SELECT
USING (
  auth.uid() IS NOT NULL AND 
  participants::text LIKE '%' || auth.uid()::text || '%'
);

CREATE POLICY "Users can create threads"
ON public.message_threads FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their threads"
ON public.message_threads FOR UPDATE
USING (participants::text LIKE '%' || auth.uid()::text || '%');

-- Simple RLS Policies for messages
CREATE POLICY "Users can view messages in their threads"
ON public.messages FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    sender_id = auth.uid() 
    OR receiver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.id = thread_id 
      AND t.participants::text LIKE '%' || auth.uid()::text || '%'
    )
  )
);

CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND sender_id = auth.uid());

CREATE POLICY "Users can update messages"
ON public.messages FOR UPDATE
USING (sender_id = auth.uid() OR auth.uid() = ANY(read_by));

-- Simple RLS Policies for automated_notifications
CREATE POLICY "Users can view their notifications"
ON public.automated_notifications FOR SELECT
USING (target_user_id = auth.uid() OR target_user_id IS NULL);

CREATE POLICY "Users can create notifications"
ON public.automated_notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their notifications"
ON public.automated_notifications FOR UPDATE
USING (target_user_id = auth.uid());

-- Indexes
CREATE INDEX idx_messages_thread_id ON public.messages(thread_id);
CREATE INDEX idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_message_threads_participants ON public.message_threads USING GIN(participants);
CREATE INDEX idx_automated_notifications_target ON public.automated_notifications(target_user_id, status);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_threads;

-- Function to update thread on new message
CREATE OR REPLACE FUNCTION public.update_thread_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.message_threads
  SET last_message = NEW.message_text,
      last_message_at = NEW.created_at,
      updated_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_message_insert
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_thread_on_message();