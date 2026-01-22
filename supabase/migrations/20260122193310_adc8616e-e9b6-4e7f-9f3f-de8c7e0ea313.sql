-- Create dedicated crm_production table
CREATE TABLE public.crm_production (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  phone_whatsapp TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  relationship_status TEXT DEFAULT 'active',
  notes TEXT,
  is_simulation BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.crm_production ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own production contacts"
ON public.crm_production FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "Users can create production contacts"
ON public.crm_production FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own production contacts"
ON public.crm_production FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own production contacts"
ON public.crm_production FOR DELETE
USING (auth.uid() = created_by);

-- Updated_at trigger
CREATE TRIGGER update_crm_production_updated_at
BEFORE UPDATE ON public.crm_production
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();