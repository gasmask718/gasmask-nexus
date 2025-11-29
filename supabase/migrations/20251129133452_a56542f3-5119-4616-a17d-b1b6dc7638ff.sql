-- Add scheduled_tasks table only (route_plans and route_stops already exist)
CREATE TABLE IF NOT EXISTS public.scheduled_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  run_at TIMESTAMP WITH TIME ZONE NOT NULL,
  recurrence_rule TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_run_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Enable RLS on scheduled_tasks
ALTER TABLE public.scheduled_tasks ENABLE ROW LEVEL SECURITY;

-- Scheduled tasks policies
CREATE POLICY "Admins can manage all scheduled tasks"
ON public.scheduled_tasks FOR ALL
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'employee', 'csr', 'warehouse')));

CREATE POLICY "Drivers can view their assigned tasks"
ON public.scheduled_tasks FOR SELECT
USING ((payload->>'driver_id')::uuid = auth.uid());

CREATE POLICY "System can insert scheduled tasks"
ON public.scheduled_tasks FOR INSERT
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_status ON public.scheduled_tasks(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_run_at ON public.scheduled_tasks(run_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_type ON public.scheduled_tasks(type);