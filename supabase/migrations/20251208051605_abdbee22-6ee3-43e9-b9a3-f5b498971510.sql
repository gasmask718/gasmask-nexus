-- Create business phone numbers table
CREATE TABLE public.business_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'both' CHECK (type IN ('call', 'sms', 'both')),
  provider TEXT DEFAULT 'twilio',
  label TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  max_calls_per_minute INTEGER DEFAULT 30,
  max_sms_per_minute INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.business_phone_numbers ENABLE ROW LEVEL SECURITY;

-- RLS policies for business phone numbers
CREATE POLICY "Users can view phone numbers for their businesses"
  ON public.business_phone_numbers FOR SELECT
  USING (business_id IN (
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can manage phone numbers for their businesses"
  ON public.business_phone_numbers FOR ALL
  USING (business_id IN (
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
  ));

-- Add phone number fields to ai_call_campaigns
ALTER TABLE public.ai_call_campaigns 
  ADD COLUMN IF NOT EXISTS call_number_id UUID REFERENCES public.business_phone_numbers(id),
  ADD COLUMN IF NOT EXISTS sms_number_id UUID REFERENCES public.business_phone_numbers(id),
  ADD COLUMN IF NOT EXISTS run_parallel BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_calls_per_minute INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS max_texts_per_minute INTEGER DEFAULT 60;

-- Add business isolation to outbound_queue
ALTER TABLE public.outbound_queue
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id),
  ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_business_phone_numbers_business ON public.business_phone_numbers(business_id);
CREATE INDEX IF NOT EXISTS idx_business_phone_numbers_type ON public.business_phone_numbers(type);
CREATE INDEX IF NOT EXISTS idx_outbound_queue_business ON public.outbound_queue(business_id);

-- Trigger for updated_at
CREATE TRIGGER update_business_phone_numbers_timestamp
  BEFORE UPDATE ON public.business_phone_numbers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();