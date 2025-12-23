-- Create intent_graphs table (one per conversation_memory)
CREATE TABLE public.intent_graphs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversation_memories(id) ON DELETE CASCADE UNIQUE,
  active_intents UUID[] DEFAULT '{}',
  dormant_intents UUID[] DEFAULT '{}',
  resolved_intents UUID[] DEFAULT '{}',
  conflicting_intents UUID[] DEFAULT '{}',
  intent_velocity_score NUMERIC(5,2) DEFAULT 0,
  confidence_score NUMERIC(3,2) DEFAULT 0.5,
  risk_index NUMERIC(3,2) DEFAULT 0,
  opportunity_index NUMERIC(3,2) DEFAULT 0,
  predictions JSONB DEFAULT '[]',
  suggestions JSONB DEFAULT '[]',
  last_analyzed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create intent_nodes table
CREATE TABLE public.intent_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intent_graph_id UUID NOT NULL REFERENCES public.intent_graphs(id) ON DELETE CASCADE,
  intent_type TEXT NOT NULL,
  origin_event_id UUID REFERENCES public.memory_events(id),
  supporting_event_ids UUID[] DEFAULT '{}',
  intent_strength INTEGER NOT NULL DEFAULT 50 CHECK (intent_strength >= 0 AND intent_strength <= 100),
  intent_direction TEXT NOT NULL DEFAULT 'neutral' CHECK (intent_direction IN ('positive', 'neutral', 'negative')),
  emotional_charge TEXT DEFAULT 'neutral',
  blockers TEXT[] DEFAULT '{}',
  dependencies UUID[] DEFAULT '{}',
  likelihood_to_convert NUMERIC(3,2) DEFAULT 0.5,
  urgency_score INTEGER DEFAULT 50 CHECK (urgency_score >= 0 AND urgency_score <= 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dormant', 'resolved', 'escalated')),
  ai_reasoning TEXT,
  human_override_note TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create intent_training_feedback for human corrections
CREATE TABLE public.intent_training_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  intent_node_id UUID NOT NULL REFERENCES public.intent_nodes(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('approve', 'reject', 'adjust_strength', 'change_type', 'add_context')),
  original_value JSONB,
  corrected_value JSONB,
  user_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_intent_graphs_conversation ON public.intent_graphs(conversation_id);
CREATE INDEX idx_intent_graphs_risk ON public.intent_graphs(risk_index DESC);
CREATE INDEX idx_intent_graphs_opportunity ON public.intent_graphs(opportunity_index DESC);
CREATE INDEX idx_intent_nodes_graph ON public.intent_nodes(intent_graph_id);
CREATE INDEX idx_intent_nodes_type ON public.intent_nodes(intent_type);
CREATE INDEX idx_intent_nodes_status ON public.intent_nodes(status);
CREATE INDEX idx_intent_nodes_strength ON public.intent_nodes(intent_strength DESC);
CREATE INDEX idx_intent_training_node ON public.intent_training_feedback(intent_node_id);

-- Enable RLS
ALTER TABLE public.intent_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intent_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intent_training_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view intent graphs" ON public.intent_graphs FOR SELECT USING (true);
CREATE POLICY "Users can create intent graphs" ON public.intent_graphs FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update intent graphs" ON public.intent_graphs FOR UPDATE USING (true);

CREATE POLICY "Users can view intent nodes" ON public.intent_nodes FOR SELECT USING (true);
CREATE POLICY "Users can create intent nodes" ON public.intent_nodes FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update intent nodes" ON public.intent_nodes FOR UPDATE USING (true);

CREATE POLICY "Users can view training feedback" ON public.intent_training_feedback FOR SELECT USING (true);
CREATE POLICY "Users can create training feedback" ON public.intent_training_feedback FOR INSERT WITH CHECK (true);

-- Trigger to update intent_graphs timestamp
CREATE OR REPLACE FUNCTION public.update_intent_graph_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_intent_graph_update
BEFORE UPDATE ON public.intent_graphs
FOR EACH ROW
EXECUTE FUNCTION public.update_intent_graph_timestamp();

CREATE TRIGGER on_intent_node_update
BEFORE UPDATE ON public.intent_nodes
FOR EACH ROW
EXECUTE FUNCTION public.update_intent_graph_timestamp();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.intent_nodes;