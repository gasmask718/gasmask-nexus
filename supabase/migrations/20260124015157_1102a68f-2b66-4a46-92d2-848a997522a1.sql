-- Add is_test_call column to manual_call_logs for Test Ring functionality
ALTER TABLE public.manual_call_logs 
ADD COLUMN IF NOT EXISTS is_test_call BOOLEAN DEFAULT false;

-- Add test_ring_result column for storing test ring execution results
ALTER TABLE public.manual_call_logs 
ADD COLUMN IF NOT EXISTS test_ring_result JSONB DEFAULT NULL;

-- Add index for filtering test calls
CREATE INDEX IF NOT EXISTS idx_manual_call_logs_test_calls ON public.manual_call_logs(is_test_call) WHERE is_test_call = true;