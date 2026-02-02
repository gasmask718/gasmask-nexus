-- Add progress tracking columns to ai_work_tasks
ALTER TABLE public.ai_work_tasks 
ADD COLUMN IF NOT EXISTS total_items INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS items_processed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS items_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS items_blocked INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS items_skipped INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS items_pending_approval INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS final_report JSONB;

-- Create ai_task_activity_log for real-time activity feed
CREATE TABLE IF NOT EXISTS public.ai_task_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.ai_work_tasks(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('success', 'skipped', 'blocked', 'failed', 'cancelled')),
  reason TEXT,
  target_entity_type TEXT,
  target_entity_id UUID,
  target_entity_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for fast activity lookups
CREATE INDEX IF NOT EXISTS idx_ai_task_activity_log_task_id ON public.ai_task_activity_log(task_id);
CREATE INDEX IF NOT EXISTS idx_ai_task_activity_log_created_at ON public.ai_task_activity_log(created_at DESC);

-- Enable RLS on activity log
ALTER TABLE public.ai_task_activity_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read activity logs
CREATE POLICY "Authenticated users can read task activity logs"
ON public.ai_task_activity_log FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert activity logs
CREATE POLICY "Authenticated users can insert task activity logs"
ON public.ai_task_activity_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add status 'cancelled' to the task status options
-- Update the status check if needed (status is text, so no enum to update)

-- Enable realtime for activity log
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_task_activity_log;