-- Create ai_playbooks table for saved workflows
CREATE TABLE public.ai_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ai_routines table for scheduled auto-run playbooks
CREATE TABLE public.ai_routines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id UUID NOT NULL REFERENCES public.ai_playbooks(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL DEFAULT 'daily',
  next_run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true,
  notify_user BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ai_routine_logs table for run results
CREATE TABLE public.ai_routine_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id UUID REFERENCES public.ai_routines(id) ON DELETE SET NULL,
  playbook_id UUID REFERENCES public.ai_playbooks(id) ON DELETE SET NULL,
  run_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  result JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_routine_logs ENABLE ROW LEVEL SECURITY;

-- Playbooks policies
CREATE POLICY "Users can view their own playbooks"
ON public.ai_playbooks FOR SELECT
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

CREATE POLICY "Users can create their own playbooks"
ON public.ai_playbooks FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own playbooks"
ON public.ai_playbooks FOR UPDATE
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

CREATE POLICY "Users can delete their own playbooks"
ON public.ai_playbooks FOR DELETE
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

-- Routines policies
CREATE POLICY "Users can view routines for their playbooks"
ON public.ai_routines FOR SELECT
USING (EXISTS (
  SELECT 1 FROM ai_playbooks WHERE ai_playbooks.id = playbook_id AND (
    ai_playbooks.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
));

CREATE POLICY "Users can create routines for their playbooks"
ON public.ai_routines FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM ai_playbooks WHERE ai_playbooks.id = playbook_id AND ai_playbooks.user_id = auth.uid()
));

CREATE POLICY "Users can update their routines"
ON public.ai_routines FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM ai_playbooks WHERE ai_playbooks.id = playbook_id AND (
    ai_playbooks.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
));

CREATE POLICY "Users can delete their routines"
ON public.ai_routines FOR DELETE
USING (EXISTS (
  SELECT 1 FROM ai_playbooks WHERE ai_playbooks.id = playbook_id AND ai_playbooks.user_id = auth.uid()
));

-- Routine logs policies
CREATE POLICY "Users can view logs for their routines"
ON public.ai_routine_logs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM ai_routines 
  JOIN ai_playbooks ON ai_playbooks.id = ai_routines.playbook_id
  WHERE ai_routines.id = routine_id AND (
    ai_playbooks.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
));

CREATE POLICY "System can insert routine logs"
ON public.ai_routine_logs FOR INSERT
WITH CHECK (true);

-- Indexes
CREATE INDEX idx_ai_playbooks_user_id ON public.ai_playbooks(user_id);
CREATE INDEX idx_ai_routines_playbook_id ON public.ai_routines(playbook_id);
CREATE INDEX idx_ai_routines_next_run ON public.ai_routines(next_run_at) WHERE active = true;
CREATE INDEX idx_ai_routine_logs_routine_id ON public.ai_routine_logs(routine_id);

-- Updated_at trigger for playbooks
CREATE TRIGGER update_ai_playbooks_updated_at
BEFORE UPDATE ON public.ai_playbooks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Updated_at trigger for routines
CREATE TRIGGER update_ai_routines_updated_at
BEFORE UPDATE ON public.ai_routines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();