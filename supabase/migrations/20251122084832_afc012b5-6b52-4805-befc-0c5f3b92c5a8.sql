-- Phase 11: Communication CRM Command Center

-- Create CRM Contacts table
CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL CHECK (type IN ('store', 'driver', 'influencer', 'wholesaler', 'partner', 'lead')),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  organization TEXT,
  notes TEXT,
  tags TEXT[],
  last_contact_date TIMESTAMPTZ,
  relationship_status TEXT NOT NULL DEFAULT 'active' CHECK (relationship_status IN ('active', 'warm', 'cold', 'lost')),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create Communication Logs table (universal timeline)
CREATE TABLE IF NOT EXISTS public.communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  influencer_id UUID REFERENCES public.influencers(id) ON DELETE SET NULL,
  wholesaler_id UUID REFERENCES public.wholesale_hubs(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('call', 'sms', 'email', 'whatsapp', 'in-person')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  summary TEXT NOT NULL,
  full_message TEXT,
  created_by UUID REFERENCES public.profiles(id),
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_date TIMESTAMPTZ,
  outcome TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_contacts_type ON public.crm_contacts(type);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_relationship_status ON public.crm_contacts(relationship_status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_last_contact ON public.crm_contacts(last_contact_date DESC);
CREATE INDEX IF NOT EXISTS idx_communication_logs_contact_id ON public.communication_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_store_id ON public.communication_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_created_at ON public.communication_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_logs_follow_up ON public.communication_logs(follow_up_required, follow_up_date);

-- Enable RLS
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crm_contacts
CREATE POLICY "Admins and CSRs can view all contacts"
  ON public.crm_contacts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'csr')
  ));

CREATE POLICY "Admins and CSRs can manage contacts"
  ON public.crm_contacts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'csr')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'csr')
  ));

-- RLS Policies for communication_logs
CREATE POLICY "Admins and CSRs can view all logs"
  ON public.communication_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'csr')
  ));

CREATE POLICY "Authenticated users can create logs"
  ON public.communication_logs FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins and CSRs can update logs"
  ON public.communication_logs FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'csr')
  ));

-- Function to update last_contact_date on crm_contacts
CREATE OR REPLACE FUNCTION update_contact_last_communication()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    UPDATE public.crm_contacts
    SET last_contact_date = NEW.created_at,
        updated_at = now()
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_contact_last_communication_trigger
  AFTER INSERT ON public.communication_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_last_communication();

-- Function to auto-update relationship status based on inactivity
CREATE OR REPLACE FUNCTION update_relationship_status()
RETURNS void AS $$
BEGIN
  -- Set to cold if 30+ days no contact
  UPDATE public.crm_contacts
  SET relationship_status = 'cold',
      updated_at = now()
  WHERE relationship_status = 'active'
    AND last_contact_date < (now() - interval '30 days');
  
  -- Set to lost if 60+ days no contact
  UPDATE public.crm_contacts
  SET relationship_status = 'lost',
      updated_at = now()
  WHERE relationship_status IN ('active', 'warm', 'cold')
    AND last_contact_date < (now() - interval '60 days');
    
  -- Set to active if contacted in last 7 days
  UPDATE public.crm_contacts
  SET relationship_status = 'active',
      updated_at = now()
  WHERE relationship_status != 'active'
    AND last_contact_date > (now() - interval '7 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;