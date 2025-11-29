-- Create ai_command_logs table for tracking AI command execution
CREATE TABLE public.ai_command_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  input_text TEXT NOT NULL,
  parsed_intent JSONB,
  status TEXT NOT NULL DEFAULT 'planned',
  error_message TEXT,
  affected_entity_type TEXT,
  affected_entity_ids TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  executed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.ai_command_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own command logs
CREATE POLICY "Users can view their own command logs"
ON public.ai_command_logs
FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own command logs
CREATE POLICY "Users can insert their own command logs"
ON public.ai_command_logs
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own command logs
CREATE POLICY "Users can update their own command logs"
ON public.ai_command_logs
FOR UPDATE
USING (user_id = auth.uid());

-- Admins can view all command logs
CREATE POLICY "Admins can view all command logs"
ON public.ai_command_logs
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

-- Create index for faster queries
CREATE INDEX idx_ai_command_logs_user_id ON public.ai_command_logs(user_id);
CREATE INDEX idx_ai_command_logs_created_at ON public.ai_command_logs(created_at DESC);