-- Create reminders table for follow-up tracking
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  wholesaler_id UUID REFERENCES public.wholesale_hubs(id) ON DELETE CASCADE,
  influencer_id UUID REFERENCES public.influencers(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  follow_up_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  CHECK (
    (store_id IS NOT NULL AND wholesaler_id IS NULL AND influencer_id IS NULL) OR
    (store_id IS NULL AND wholesaler_id IS NOT NULL AND influencer_id IS NULL) OR
    (store_id IS NULL AND wholesaler_id IS NULL AND influencer_id IS NOT NULL)
  )
);

-- Create communication templates table
CREATE TABLE IF NOT EXISTS public.communication_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  category TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on reminders
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies for reminders
CREATE POLICY "Anyone can view reminders"
ON public.reminders
FOR SELECT
USING (true);

CREATE POLICY "Field workers can create reminders"
ON public.reminders
FOR INSERT
WITH CHECK (
  auth.uid() = assigned_to OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'csr', 'driver', 'biker')
  )
);

CREATE POLICY "Assigned users can update their reminders"
ON public.reminders
FOR UPDATE
USING (
  auth.uid() = assigned_to OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'csr')
  )
);

-- Enable RLS on communication templates
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for templates
CREATE POLICY "Anyone can view active templates"
ON public.communication_templates
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage templates"
ON public.communication_templates
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);

-- Create indexes for performance
CREATE INDEX idx_reminders_follow_up_date ON public.reminders(follow_up_date);
CREATE INDEX idx_reminders_status ON public.reminders(status);
CREATE INDEX idx_reminders_assigned_to ON public.reminders(assigned_to);
CREATE INDEX idx_communication_templates_category ON public.communication_templates(category);

-- Trigger to update reminders status based on date
CREATE OR REPLACE FUNCTION update_reminder_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'pending' AND NEW.follow_up_date < CURRENT_DATE THEN
    NEW.status := 'overdue';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_reminder_status
BEFORE INSERT OR UPDATE ON public.reminders
FOR EACH ROW
EXECUTE FUNCTION update_reminder_status();

-- Trigger to update communication_templates updated_at
CREATE TRIGGER update_communication_templates_updated_at
BEFORE UPDATE ON public.communication_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();