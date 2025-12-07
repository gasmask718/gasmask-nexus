
-- Voice Personas table
CREATE TABLE public.voice_personas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  voice_profile_id UUID REFERENCES public.voice_profiles(id),
  tone TEXT DEFAULT 'professional',
  language TEXT DEFAULT 'en',
  use_for_ai_texts BOOLEAN DEFAULT true,
  use_for_ai_calls BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Call Flows table
CREATE TABLE public.call_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  persona_id UUID REFERENCES public.voice_personas(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Call Flow Nodes table
CREATE TABLE public.call_flow_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.call_flows(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL CHECK (node_type IN ('start', 'message', 'question', 'branch', 'end')),
  content TEXT,
  expected_input TEXT,
  metadata JSONB DEFAULT '{}',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Call Flow Edges table
CREATE TABLE public.call_flow_edges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.call_flows(id) ON DELETE CASCADE,
  from_node_id UUID NOT NULL REFERENCES public.call_flow_nodes(id) ON DELETE CASCADE,
  to_node_id UUID NOT NULL REFERENCES public.call_flow_nodes(id) ON DELETE CASCADE,
  condition_label TEXT,
  condition_type TEXT DEFAULT 'match-text',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add persona_id and flow tracking to ai_call_logs
ALTER TABLE public.ai_call_logs 
ADD COLUMN IF NOT EXISTS persona_id UUID REFERENCES public.voice_personas(id),
ADD COLUMN IF NOT EXISTS flow_id UUID REFERENCES public.call_flows(id),
ADD COLUMN IF NOT EXISTS flow_path JSONB DEFAULT '[]';

-- Enable RLS on all new tables
ALTER TABLE public.voice_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_flow_edges ENABLE ROW LEVEL SECURITY;

-- RLS policies for voice_personas
CREATE POLICY "Users can view voice personas" ON public.voice_personas FOR SELECT USING (true);
CREATE POLICY "Auth users can manage voice personas" ON public.voice_personas FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS policies for call_flows
CREATE POLICY "Users can view call flows" ON public.call_flows FOR SELECT USING (true);
CREATE POLICY "Auth users can manage call flows" ON public.call_flows FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS policies for call_flow_nodes
CREATE POLICY "Users can view call flow nodes" ON public.call_flow_nodes FOR SELECT USING (true);
CREATE POLICY "Auth users can manage call flow nodes" ON public.call_flow_nodes FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS policies for call_flow_edges
CREATE POLICY "Users can view call flow edges" ON public.call_flow_edges FOR SELECT USING (true);
CREATE POLICY "Auth users can manage call flow edges" ON public.call_flow_edges FOR ALL USING (auth.uid() IS NOT NULL);

-- Indexes for performance
CREATE INDEX idx_voice_personas_business ON public.voice_personas(business_id);
CREATE INDEX idx_voice_personas_default ON public.voice_personas(is_default) WHERE is_default = true;
CREATE INDEX idx_call_flows_business ON public.call_flows(business_id);
CREATE INDEX idx_call_flow_nodes_flow ON public.call_flow_nodes(flow_id);
CREATE INDEX idx_call_flow_edges_flow ON public.call_flow_edges(flow_id);

-- Triggers for updated_at
CREATE TRIGGER update_voice_personas_updated_at BEFORE UPDATE ON public.voice_personas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_call_flows_updated_at BEFORE UPDATE ON public.call_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
