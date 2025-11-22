-- Phase 9: Sales Pipeline OS - Database Schema

-- 1. Sales prospects table
CREATE TABLE IF NOT EXISTS public.sales_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  store_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zipcode TEXT,
  source TEXT CHECK (source IN ('walk-in', 'instagram', 'referral', 'cold-call', 'event')),
  pipeline_stage TEXT NOT NULL DEFAULT 'new' CHECK (pipeline_stage IN ('new','contacted','follow-up','interested','qualified','activated','closed-lost')),
  next_follow_up TIMESTAMPTZ,
  last_contacted TIMESTAMPTZ,
  notes TEXT,
  assigned_to UUID REFERENCES public.profiles(id),
  priority INTEGER DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  ai_score INTEGER DEFAULT 50 CHECK (ai_score >= 0 AND ai_score <= 100),
  likelihood_to_activate INTEGER DEFAULT 50 CHECK (likelihood_to_activate >= 0 AND likelihood_to_activate <= 100),
  total_communications INTEGER DEFAULT 0,
  converted_store_id UUID REFERENCES public.stores(id)
);

ALTER TABLE public.sales_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all prospects"
  ON public.sales_prospects FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Sales reps can view assigned prospects"
  ON public.sales_prospects FOR SELECT
  USING (
    assigned_to = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'csr'))
  );

CREATE POLICY "Sales reps can update assigned prospects"
  ON public.sales_prospects FOR UPDATE
  USING (
    assigned_to = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'csr'))
  );

CREATE POLICY "System can insert prospects"
  ON public.sales_prospects FOR INSERT
  WITH CHECK (true);

-- 2. Sales tasks table
CREATE TABLE IF NOT EXISTS public.sales_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sales_user_id UUID NOT NULL REFERENCES public.profiles(id),
  prospect_id UUID NOT NULL REFERENCES public.sales_prospects(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('call', 'text', 'email', 'follow-up', 'meeting')),
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'cancelled')),
  notes TEXT,
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.sales_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tasks"
  ON public.sales_tasks FOR ALL
  USING (
    sales_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    sales_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Update communication_events to support prospects
ALTER TABLE public.communication_events
  DROP CONSTRAINT IF EXISTS communication_events_linked_entity_type_check;

ALTER TABLE public.communication_events
  ADD CONSTRAINT communication_events_linked_entity_type_check
  CHECK (linked_entity_type IN ('store', 'wholesaler', 'influencer', 'prospect'));

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_prospects_assigned_to ON public.sales_prospects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_sales_prospects_pipeline_stage ON public.sales_prospects(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_sales_prospects_next_follow_up ON public.sales_prospects(next_follow_up);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_sales_user_id ON public.sales_tasks(sales_user_id);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_prospect_id ON public.sales_tasks(prospect_id);
CREATE INDEX IF NOT EXISTS idx_sales_tasks_due_date ON public.sales_tasks(due_date);

-- 5. Trigger for updated_at
CREATE TRIGGER update_sales_prospects_updated_at
  BEFORE UPDATE ON public.sales_prospects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_tasks_updated_at
  BEFORE UPDATE ON public.sales_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();