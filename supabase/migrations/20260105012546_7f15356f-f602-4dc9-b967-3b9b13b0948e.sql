-- Create crm_partners table for real persistent partner data
CREATE TABLE public.crm_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  partner_category TEXT NOT NULL,
  state TEXT,
  city TEXT,
  service_area TEXT[],
  commission_rate NUMERIC(5,2),
  contract_status TEXT DEFAULT 'pending',
  pricing_range TEXT,
  availability_rules TEXT,
  booking_link TEXT,
  notes TEXT,
  business_slug TEXT NOT NULL DEFAULT 'toptier-experience',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_partners ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view partners
CREATE POLICY "Authenticated users can view crm partners"
ON public.crm_partners
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to manage partners
CREATE POLICY "Authenticated users can manage crm partners"
ON public.crm_partners
FOR ALL
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_crm_partners_updated_at
BEFORE UPDATE ON public.crm_partners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();