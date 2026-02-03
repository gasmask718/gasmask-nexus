-- Add soft delete columns to ai_work_tasks table
ALTER TABLE public.ai_work_tasks 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID,
ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Add index for efficient querying of non-deleted tasks
CREATE INDEX IF NOT EXISTS idx_ai_work_tasks_deleted_at ON public.ai_work_tasks(deleted_at) WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.ai_work_tasks.deleted_at IS 'Soft delete timestamp - tasks with non-null value are considered deleted';
COMMENT ON COLUMN public.ai_work_tasks.deleted_by IS 'User ID who deleted the task';
COMMENT ON COLUMN public.ai_work_tasks.deletion_reason IS 'Reason for task deletion';