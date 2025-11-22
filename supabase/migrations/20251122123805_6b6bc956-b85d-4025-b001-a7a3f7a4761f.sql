-- Phase 23: AI VA Training Center Tables

-- VAs table
CREATE TABLE IF NOT EXISTS public.vas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  tier INTEGER DEFAULT 1 CHECK (tier >= 1 AND tier <= 5),
  skill_score INTEGER DEFAULT 0,
  total_tasks_completed INTEGER DEFAULT 0,
  success_rate NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'training')),
  hired_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- VA Skills
CREATE TABLE IF NOT EXISTS public.va_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  va_id UUID REFERENCES public.vas(id) ON DELETE CASCADE,
  skill_type TEXT NOT NULL,
  proficiency_level INTEGER DEFAULT 1 CHECK (proficiency_level >= 1 AND proficiency_level <= 5),
  last_evaluated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- VA Lessons
CREATE TABLE IF NOT EXISTS public.va_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT,
  video_url TEXT,
  quiz_questions JSONB DEFAULT '[]'::jsonb,
  difficulty INTEGER DEFAULT 1 CHECK (difficulty >= 1 AND difficulty <= 5),
  xp_reward INTEGER DEFAULT 10,
  estimated_minutes INTEGER DEFAULT 15,
  is_required BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- VA Lesson Attempts
CREATE TABLE IF NOT EXISTS public.va_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  va_id UUID REFERENCES public.vas(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.va_lessons(id) ON DELETE CASCADE,
  score INTEGER,
  time_spent_minutes INTEGER,
  answers JSONB,
  passed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- VA Performance Scores
CREATE TABLE IF NOT EXISTS public.va_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  va_id UUID REFERENCES public.vas(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- VA Tasks
CREATE TABLE IF NOT EXISTS public.va_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  va_id UUID REFERENCES public.vas(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL,
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'failed')),
  entity_type TEXT,
  entity_id UUID,
  description TEXT,
  ai_instructions JSONB,
  result JSONB,
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- VA Performance Metrics (Aggregated)
CREATE TABLE IF NOT EXISTS public.va_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  va_id UUID REFERENCES public.vas(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  call_attempts INTEGER DEFAULT 0,
  contacts_made INTEGER DEFAULT 0,
  conversations INTEGER DEFAULT 0,
  appointments_set INTEGER DEFAULT 0,
  contracts_signed INTEGER DEFAULT 0,
  data_entries INTEGER DEFAULT 0,
  ai_evaluation_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(va_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vas_tier ON public.vas(tier);
CREATE INDEX IF NOT EXISTS idx_vas_status ON public.vas(status);
CREATE INDEX IF NOT EXISTS idx_va_skills_va_id ON public.va_skills(va_id);
CREATE INDEX IF NOT EXISTS idx_va_attempts_va_id ON public.va_attempts(va_id);
CREATE INDEX IF NOT EXISTS idx_va_tasks_va_id ON public.va_tasks(va_id);
CREATE INDEX IF NOT EXISTS idx_va_tasks_status ON public.va_tasks(status);
CREATE INDEX IF NOT EXISTS idx_va_performance_va_id ON public.va_performance_metrics(va_id);

-- RLS Policies
ALTER TABLE public.vas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.va_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.va_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.va_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.va_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.va_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.va_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Admins can manage everything
CREATE POLICY "Admins manage VAs" ON public.vas
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage VA skills" ON public.va_skills
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage VA lessons" ON public.va_lessons
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage VA attempts" ON public.va_attempts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage VA scores" ON public.va_scores
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage VA tasks" ON public.va_tasks
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage VA performance" ON public.va_performance_metrics
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- VAs can view their own data
CREATE POLICY "VAs view own profile" ON public.vas
  FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "VAs view own tasks" ON public.va_tasks
  FOR SELECT USING (
    va_id IN (SELECT id FROM public.vas WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "VAs update own tasks" ON public.va_tasks
  FOR UPDATE USING (
    va_id IN (SELECT id FROM public.vas WHERE user_id = auth.uid())
  );

-- Everyone can view lessons
CREATE POLICY "Anyone view lessons" ON public.va_lessons
  FOR SELECT USING (true);