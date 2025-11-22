-- Phase 19: HR OS - Additional Tables

-- Add hr_interviews table
CREATE TABLE IF NOT EXISTS public.hr_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID REFERENCES public.hr_applicants(id) ON DELETE CASCADE,
  interviewer_id UUID REFERENCES public.profiles(id),
  scheduled_for TIMESTAMP WITH TIME ZONE,
  result TEXT CHECK (result IN ('pass', 'fail', 'pending')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add hr_employees table (comprehensive employee management)
CREATE TABLE IF NOT EXISTS public.hr_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  job_title TEXT NOT NULL,
  department TEXT,
  start_date DATE,
  employment_type TEXT CHECK (employment_type IN ('full-time', 'part-time', 'contractor')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add hr_onboarding_tasks table
CREATE TABLE IF NOT EXISTS public.hr_onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add hr_payroll table
CREATE TABLE IF NOT EXISTS public.hr_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  pay_rate DECIMAL(10,2),
  pay_type TEXT CHECK (pay_type IN ('hourly', 'salary', 'commission')),
  last_pay_date DATE,
  next_pay_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_hr_interviews_applicant ON public.hr_interviews(applicant_id);
CREATE INDEX IF NOT EXISTS idx_hr_interviews_interviewer ON public.hr_interviews(interviewer_id);
CREATE INDEX IF NOT EXISTS idx_hr_interviews_scheduled ON public.hr_interviews(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_hr_employees_user ON public.hr_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_status ON public.hr_employees(status);
CREATE INDEX IF NOT EXISTS idx_hr_employees_department ON public.hr_employees(department);
CREATE INDEX IF NOT EXISTS idx_hr_onboarding_employee ON public.hr_onboarding_tasks(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_onboarding_status ON public.hr_onboarding_tasks(status);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_employee ON public.hr_payroll(employee_id);

-- Enable RLS
ALTER TABLE public.hr_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_payroll ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hr_interviews
CREATE POLICY "Admins can manage interviews"
  ON public.hr_interviews
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Interviewers can view their interviews"
  ON public.hr_interviews
  FOR SELECT
  USING (interviewer_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- RLS Policies for hr_employees
CREATE POLICY "Admins can manage employees"
  ON public.hr_employees
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view their own record"
  ON public.hr_employees
  FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- RLS Policies for hr_onboarding_tasks
CREATE POLICY "Admins can manage onboarding tasks"
  ON public.hr_onboarding_tasks
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view their onboarding tasks"
  ON public.hr_onboarding_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hr_employees
      WHERE id = employee_id AND user_id = auth.uid()
    ) OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Employees can update their onboarding tasks"
  ON public.hr_onboarding_tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.hr_employees
      WHERE id = employee_id AND user_id = auth.uid()
    )
  );

-- RLS Policies for hr_payroll
CREATE POLICY "Admins can manage payroll"
  ON public.hr_payroll
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees can view their payroll"
  ON public.hr_payroll
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hr_employees
      WHERE id = employee_id AND user_id = auth.uid()
    ) OR has_role(auth.uid(), 'admin')
  );

-- Add trigger for updated_at
CREATE TRIGGER update_hr_employees_updated_at
  BEFORE UPDATE ON public.hr_employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hr_payroll_updated_at
  BEFORE UPDATE ON public.hr_payroll
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();