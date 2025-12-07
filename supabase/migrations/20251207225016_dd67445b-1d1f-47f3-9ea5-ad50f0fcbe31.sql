
-- Communication Center V6: Multi-Agent AI System

-- 1. AI Agents - The core agent definitions
CREATE TABLE public.ai_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer_service', 'sales', 'retention', 'billing', 'dispatcher', 'supervisor')),
  persona_id UUID REFERENCES public.voice_personas(id) ON DELETE SET NULL,
  active BOOLEAN DEFAULT true,
  capabilities JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  success_rate NUMERIC(5,2) DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Agent Assignments - Task routing to agents
CREATE TABLE public.agent_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.store_master(id) ON DELETE SET NULL,
  contact_id UUID,
  message_id UUID,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'escalated', 'failed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  ai_notes TEXT,
  result JSONB,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Agent Supervision Logs - Supervisor decisions
CREATE TABLE public.agent_supervision_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supervisor_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.agent_assignments(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject', 'modify', 'escalate', 'auto-correct')),
  notes TEXT,
  original_action JSONB,
  corrected_action JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Agent Store Memory - Per-store learning
CREATE TABLE public.agent_store_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('preference', 'history', 'tone', 'warnings', 'success_patterns')),
  memory_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(5,2) DEFAULT 50,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agent_id, store_id, memory_type)
);

-- 5. Agent Handoff Logs - Agent-to-agent coordination
CREATE TABLE public.agent_handoff_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  to_agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES public.agent_assignments(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  context JSONB,
  accepted BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_supervision_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_store_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_handoff_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all access to ai_agents" ON public.ai_agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to agent_assignments" ON public.agent_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to agent_supervision_logs" ON public.agent_supervision_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to agent_store_memory" ON public.agent_store_memory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to agent_handoff_logs" ON public.agent_handoff_logs FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_ai_agents_business ON public.ai_agents(business_id);
CREATE INDEX idx_ai_agents_role ON public.ai_agents(role);
CREATE INDEX idx_agent_assignments_agent ON public.agent_assignments(agent_id);
CREATE INDEX idx_agent_assignments_status ON public.agent_assignments(status);
CREATE INDEX idx_agent_store_memory_store ON public.agent_store_memory(store_id);
CREATE INDEX idx_agent_handoff_logs_from ON public.agent_handoff_logs(from_agent_id);

-- Enable realtime for live monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_assignments;
