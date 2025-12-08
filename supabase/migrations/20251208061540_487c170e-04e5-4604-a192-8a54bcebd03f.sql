-- Follow-Up Queue table
CREATE TABLE public.follow_up_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.store_master(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id),
  vertical_id UUID REFERENCES public.brand_verticals(id),
  brand TEXT,
  reason TEXT NOT NULL,
  recommended_action TEXT NOT NULL CHECK (recommended_action IN ('ai_call', 'ai_text', 'manual_call', 'manual_text')),
  priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  due_at TIMESTAMP WITH TIME ZONE NOT NULL,
  context JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'canceled', 'overdue')),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.follow_up_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view follow-ups"
ON public.follow_up_queue FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert follow-ups"
ON public.follow_up_queue FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update follow-ups"
ON public.follow_up_queue FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Index for efficient queries
CREATE INDEX idx_follow_up_queue_status ON public.follow_up_queue(status);
CREATE INDEX idx_follow_up_queue_due_at ON public.follow_up_queue(due_at);
CREATE INDEX idx_follow_up_queue_store_id ON public.follow_up_queue(store_id);
CREATE INDEX idx_follow_up_queue_vertical_id ON public.follow_up_queue(vertical_id);

-- Trigger for updated_at
CREATE TRIGGER update_follow_up_queue_updated_at
BEFORE UPDATE ON public.follow_up_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-mark overdue follow-ups
CREATE OR REPLACE FUNCTION public.mark_overdue_followups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.follow_up_queue
  SET status = 'overdue'
  WHERE status = 'pending'
    AND due_at < now();
END;
$$;