-- Create crm_deals table for TopTier CRM deals/bookings
CREATE TABLE public.crm_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_slug TEXT NOT NULL DEFAULT 'toptier-experience',
  customer_id UUID,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  partner_id UUID REFERENCES public.crm_partners(id),
  partner_name TEXT,
  category TEXT,
  state TEXT,
  city TEXT,
  event_date TIMESTAMP WITH TIME ZONE,
  event_time TEXT,
  booking_value NUMERIC DEFAULT 0,
  deposit_amount NUMERIC DEFAULT 0,
  commission_rate NUMERIC DEFAULT 10,
  commission_amount NUMERIC GENERATED ALWAYS AS (booking_value * commission_rate / 100) STORED,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  special_requests TEXT,
  is_simulation BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view all crm_deals" 
ON public.crm_deals 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Users can create crm_deals" 
ON public.crm_deals 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Users can update crm_deals" 
ON public.crm_deals 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Users can delete crm_deals" 
ON public.crm_deals 
FOR DELETE 
TO authenticated 
USING (true);

-- Create index for faster queries
CREATE INDEX idx_crm_deals_business_slug ON public.crm_deals(business_slug);
CREATE INDEX idx_crm_deals_partner_id ON public.crm_deals(partner_id);
CREATE INDEX idx_crm_deals_status ON public.crm_deals(status);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_crm_deals_updated_at
BEFORE UPDATE ON public.crm_deals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();