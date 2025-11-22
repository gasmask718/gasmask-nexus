-- Phase 19: HR OS for GasMask Universe
-- Create all necessary tables for Human Resources management

-- HR Applicants Table
CREATE TABLE IF NOT EXISTS public.hr_applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  position TEXT NOT NULL CHECK (position IN ('driver', 'biker', 'store_checker', 'warehouse', 'admin', 'va', 'ambassador')),
  city TEXT,
  state TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'screening', 'interview', 'approved', 'rejected')),
  notes TEXT,
  documents JSONB DEFAULT '[]'::jsonb,
  ai_screening_score INTEGER,
  ai_screening_summary TEXT,
  screened_at TIMESTAMP WITH TIME ZONE,
  interviewed_at TIMESTAMP WITH TIME ZONE,
  interviewed_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES public.profiles(id),
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID REFERENCES public.profiles(id),
  rejection_reason TEXT
);

-- HR Staff Table
CREATE TABLE IF NOT EXISTS public.hr_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  applicant_id UUID REFERENCES public.hr_applicants(id),
  position TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'terminated')),
  hire_date DATE,
  termination_date DATE,
  last_active_date TIMESTAMP WITH TIME ZONE,
  performance_score INTEGER DEFAULT 50,
  xp_total INTEGER DEFAULT 0,
  city TEXT,
  state TEXT,
  notes TEXT
);

-- HR Documents Table
CREATE TABLE IF NOT EXISTS public.hr_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  staff_id UUID REFERENCES public.hr_staff(id) ON DELETE CASCADE,
  applicant_id UUID REFERENCES public.hr_applicants(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('id', 'license', 'w9', 'agreement', 'contract', 'certification', 'other')),
  document_name TEXT NOT NULL,
  document_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id),
  verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- HR Training Modules Table
CREATE TABLE IF NOT EXISTS public.hr_training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  content TEXT,
  quiz_questions JSONB DEFAULT '[]'::jsonb,
  passing_score INTEGER DEFAULT 70,
  required_for_positions TEXT[] DEFAULT ARRAY[]::TEXT[],
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- HR Training Progress Table
CREATE TABLE IF NOT EXISTS public.hr_training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  staff_id UUID REFERENCES public.hr_staff(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.hr_training_modules(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  quiz_score INTEGER,
  quiz_answers JSONB,
  attempts INTEGER DEFAULT 0,
  UNIQUE(staff_id, module_id)
);

-- HR Contracts Table
CREATE TABLE IF NOT EXISTS public.hr_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  template_name TEXT NOT NULL,
  template_content TEXT NOT NULL,
  variables JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true
);

-- HR Contract Instances Table
CREATE TABLE IF NOT EXISTS public.hr_contract_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  staff_id UUID REFERENCES public.hr_staff(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.hr_contracts(id),
  generated_content TEXT NOT NULL,
  pdf_url TEXT,
  signed BOOLEAN DEFAULT false,
  signed_at TIMESTAMP WITH TIME ZONE,
  signature_data JSONB
);

-- HR Notifications Table
CREATE TABLE IF NOT EXISTS public.hr_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_hr_applicants_status ON public.hr_applicants(status);
CREATE INDEX IF NOT EXISTS idx_hr_applicants_position ON public.hr_applicants(position);
CREATE INDEX IF NOT EXISTS idx_hr_applicants_created_at ON public.hr_applicants(created_at);
CREATE INDEX IF NOT EXISTS idx_hr_staff_user_id ON public.hr_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_staff_status ON public.hr_staff(status);
CREATE INDEX IF NOT EXISTS idx_hr_staff_position ON public.hr_staff(position);
CREATE INDEX IF NOT EXISTS idx_hr_documents_staff_id ON public.hr_documents(staff_id);
CREATE INDEX IF NOT EXISTS idx_hr_documents_applicant_id ON public.hr_documents(applicant_id);
CREATE INDEX IF NOT EXISTS idx_hr_training_progress_staff_id ON public.hr_training_progress(staff_id);
CREATE INDEX IF NOT EXISTS idx_hr_training_progress_module_id ON public.hr_training_progress(module_id);
CREATE INDEX IF NOT EXISTS idx_hr_notifications_user_id ON public.hr_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_notifications_read ON public.hr_notifications(read);

-- Enable RLS on all tables
ALTER TABLE public.hr_applicants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_contract_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for HR Applicants
CREATE POLICY "Admins can manage applicants" ON public.hr_applicants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for HR Staff
CREATE POLICY "Admins can manage staff" ON public.hr_staff
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Staff can view their own record" ON public.hr_staff
  FOR SELECT USING (user_id = auth.uid());

-- RLS Policies for HR Documents
CREATE POLICY "Admins can manage documents" ON public.hr_documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Staff can view their own documents" ON public.hr_documents
  FOR SELECT USING (
    staff_id IN (SELECT id FROM public.hr_staff WHERE user_id = auth.uid())
  );

-- RLS Policies for Training Modules
CREATE POLICY "Admins can manage training modules" ON public.hr_training_modules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Everyone can view active training modules" ON public.hr_training_modules
  FOR SELECT USING (is_active = true);

-- RLS Policies for Training Progress
CREATE POLICY "Admins can manage training progress" ON public.hr_training_progress
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Staff can view and update their own progress" ON public.hr_training_progress
  FOR ALL USING (
    staff_id IN (SELECT id FROM public.hr_staff WHERE user_id = auth.uid())
  );

-- RLS Policies for Contracts
CREATE POLICY "Admins can manage contracts" ON public.hr_contracts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for Contract Instances
CREATE POLICY "Admins can manage contract instances" ON public.hr_contract_instances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Staff can view their own contracts" ON public.hr_contract_instances
  FOR SELECT USING (
    staff_id IN (SELECT id FROM public.hr_staff WHERE user_id = auth.uid())
  );

-- RLS Policies for Notifications
CREATE POLICY "Users can view their own notifications" ON public.hr_notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON public.hr_notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON public.hr_notifications
  FOR INSERT WITH CHECK (true);