-- Create conversation_memories table (one per contact)
CREATE TABLE public.conversation_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL,
  associated_businesses UUID[] DEFAULT '{}',
  first_interaction_at TIMESTAMP WITH TIME ZONE,
  last_interaction_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dormant', 'escalated', 'closed')),
  memory_summary_current TEXT,
  memory_summary_versions JSONB DEFAULT '[]',
  sentiment_trend TEXT DEFAULT 'neutral',
  risk_flags TEXT[] DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  unresolved_items JSONB DEFAULT '[]',
  ai_confidence_score NUMERIC(3,2) DEFAULT 0.5,
  is_frozen BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create memory_events table (immutable events)
CREATE TABLE public.memory_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversation_memories(id) ON DELETE CASCADE,
  business_id UUID,
  channel TEXT NOT NULL CHECK (channel IN ('call', 'text', 'email', 'ai_action', 'human_note', 'system')),
  actor TEXT NOT NULL CHECK (actor IN ('human', 'ai', 'system')),
  actor_name TEXT,
  direction TEXT CHECK (direction IN ('inbound', 'outbound', 'internal')),
  raw_content TEXT,
  ai_extracted_summary TEXT,
  sentiment_score NUMERIC(3,2),
  tags TEXT[] DEFAULT '{}',
  linked_tasks UUID[] DEFAULT '{}',
  escalation_flag BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_conversation_memories_contact ON public.conversation_memories(contact_id);
CREATE INDEX idx_conversation_memories_status ON public.conversation_memories(status);
CREATE INDEX idx_conversation_memories_last_interaction ON public.conversation_memories(last_interaction_at DESC);
CREATE INDEX idx_memory_events_conversation ON public.memory_events(conversation_id);
CREATE INDEX idx_memory_events_channel ON public.memory_events(channel);
CREATE INDEX idx_memory_events_created ON public.memory_events(created_at DESC);
CREATE INDEX idx_memory_events_business ON public.memory_events(business_id);

-- Enable RLS
ALTER TABLE public.conversation_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for conversation_memories
CREATE POLICY "Users can view all conversation memories"
ON public.conversation_memories FOR SELECT
USING (true);

CREATE POLICY "Users can create conversation memories"
ON public.conversation_memories FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update conversation memories"
ON public.conversation_memories FOR UPDATE
USING (true);

-- RLS policies for memory_events (immutable - no update/delete for raw events)
CREATE POLICY "Users can view all memory events"
ON public.memory_events FOR SELECT
USING (true);

CREATE POLICY "Users can create memory events"
ON public.memory_events FOR INSERT
WITH CHECK (true);

-- Trigger to update conversation memory timestamps
CREATE OR REPLACE FUNCTION public.update_conversation_memory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversation_memories
  SET 
    last_interaction_at = NEW.created_at,
    first_interaction_at = COALESCE(first_interaction_at, NEW.created_at),
    updated_at = now()
  WHERE id = NEW.conversation_id;
  
  -- Add business to associated_businesses if not already there
  IF NEW.business_id IS NOT NULL THEN
    UPDATE public.conversation_memories
    SET associated_businesses = array_append(
      array_remove(associated_businesses, NEW.business_id),
      NEW.business_id
    )
    WHERE id = NEW.conversation_id
    AND NOT (NEW.business_id = ANY(associated_businesses));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_memory_event_created
AFTER INSERT ON public.memory_events
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_memory_timestamp();

-- Enable realtime for memory events
ALTER PUBLICATION supabase_realtime ADD TABLE public.memory_events;