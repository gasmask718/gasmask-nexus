-- Extend crm_contacts with AI fields
ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS relationship_score INTEGER DEFAULT 50 CHECK (relationship_score >= 0 AND relationship_score <= 100),
  ADD COLUMN IF NOT EXISTS ai_keywords TEXT[],
  ADD COLUMN IF NOT EXISTS ai_sentiment TEXT DEFAULT 'neutral' CHECK (ai_sentiment IN ('positive','neutral','negative','mixed')),
  ADD COLUMN IF NOT EXISTS ai_last_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_next_action TEXT,
  ADD COLUMN IF NOT EXISTS ai_priority INTEGER DEFAULT 50 CHECK (ai_priority >= 0 AND ai_priority <= 100);

-- Create ai_communication_queue table
CREATE TABLE IF NOT EXISTS public.ai_communication_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('store','contact','influencer','wholesaler','driver','ambassador')),
  entity_id UUID NOT NULL,
  reason TEXT NOT NULL,
  suggested_action TEXT NOT NULL,
  urgency INTEGER NOT NULL DEFAULT 50 CHECK (urgency >= 0 AND urgency <= 100),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','actioned','skipped')),
  actioned_by UUID REFERENCES public.profiles(id),
  actioned_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_comm_queue_entity ON public.ai_communication_queue(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_comm_queue_urgency ON public.ai_communication_queue(urgency DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_comm_queue_status ON public.ai_communication_queue(status);

-- RLS Policies
ALTER TABLE public.ai_communication_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage communication queue"
  ON public.ai_communication_queue
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert to queue"
  ON public.ai_communication_queue
  FOR INSERT
  WITH CHECK (true);