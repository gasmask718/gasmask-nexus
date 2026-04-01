
-- Add voice config columns to elevenlabs_agents
ALTER TABLE public.elevenlabs_agents
  ADD COLUMN IF NOT EXISTS voice_model TEXT DEFAULT 'eleven_turbo_v2_5',
  ADD COLUMN IF NOT EXISTS llm_model TEXT DEFAULT 'gpt-4o',
  ADD COLUMN IF NOT EXISTS temperature NUMERIC(3,2) DEFAULT 0.7,
  ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 1024,
  ADD COLUMN IF NOT EXISTS stability NUMERIC(3,2) DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS similarity_boost NUMERIC(3,2) DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS latency_optimization INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS agent_status TEXT DEFAULT 'unassigned';

-- Number-to-agent assignment tracking
CREATE TABLE IF NOT EXISTS public.voice_ops_number_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number_id UUID REFERENCES public.business_phone_numbers(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.elevenlabs_agents(id) ON DELETE SET NULL,
  brand TEXT NOT NULL DEFAULT 'dynasty_connect',
  status TEXT DEFAULT 'unassigned' CHECK (status IN ('connected','fallback','unassigned')),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(phone_number_id)
);

ALTER TABLE public.voice_ops_number_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select" ON public.voice_ops_number_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert" ON public.voice_ops_number_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON public.voice_ops_number_assignments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON public.voice_ops_number_assignments FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_vona_phone ON public.voice_ops_number_assignments (phone_number_id);
CREATE INDEX idx_vona_agent ON public.voice_ops_number_assignments (agent_id);
