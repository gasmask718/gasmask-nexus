-- Sprint 3: Add handoff columns to manual_call_logs + campaign_call_queue table

-- 3.1 Add handoff tracking columns to manual_call_logs
ALTER TABLE public.manual_call_logs
  ADD COLUMN IF NOT EXISTS handoff_triggered_at timestamptz,
  ADD COLUMN IF NOT EXISTS handoff_target_number text;

-- 3.2 Create campaign_call_queue table
CREATE TABLE IF NOT EXISTS public.campaign_call_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid REFERENCES public.ai_call_campaigns(id) ON DELETE CASCADE,
  store_id uuid REFERENCES public.store_master(id),
  status text NOT NULL DEFAULT 'queued',
  call_sid text,
  error_message text,
  attempt_number int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- Index for campaign lookups
CREATE INDEX IF NOT EXISTS idx_campaign_call_queue_campaign ON public.campaign_call_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_call_queue_status ON public.campaign_call_queue(status);

-- RLS
ALTER TABLE public.campaign_call_queue ENABLE ROW LEVEL SECURITY;

-- Admin/owner can manage campaign queues
CREATE POLICY "Admin manages campaign queue"
  ON public.campaign_call_queue
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Enable realtime for campaign queue status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_call_queue;