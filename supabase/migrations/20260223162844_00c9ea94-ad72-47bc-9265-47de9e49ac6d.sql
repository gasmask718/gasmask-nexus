-- Fix RLS policy on campaign_call_queue to include WITH CHECK for INSERT

ALTER TABLE public.campaign_call_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manages campaign queue" ON public.campaign_call_queue;

CREATE POLICY "Admin manages campaign queue"
  ON public.campaign_call_queue
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );