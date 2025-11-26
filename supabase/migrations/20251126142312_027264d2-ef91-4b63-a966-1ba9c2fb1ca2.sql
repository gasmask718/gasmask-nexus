-- Add missing fields to communication_logs for unified logging system
ALTER TABLE public.communication_logs 
ADD COLUMN IF NOT EXISTS brand text,
ADD COLUMN IF NOT EXISTS performed_by text CHECK (performed_by IN ('ai', 'va', 'system')),
ADD COLUMN IF NOT EXISTS delivery_status text,
ADD COLUMN IF NOT EXISTS recipient_phone text,
ADD COLUMN IF NOT EXISTS recipient_email text,
ADD COLUMN IF NOT EXISTS sender_phone text,
ADD COLUMN IF NOT EXISTS sender_email text,
ADD COLUMN IF NOT EXISTS message_content text,
ADD COLUMN IF NOT EXISTS call_duration integer,
ADD COLUMN IF NOT EXISTS recording_url text,
ADD COLUMN IF NOT EXISTS ai_confidence_score numeric(3,2);

-- Create index for faster lookups when matching incoming messages
CREATE INDEX IF NOT EXISTS idx_communication_logs_recipient_phone ON public.communication_logs(recipient_phone);
CREATE INDEX IF NOT EXISTS idx_communication_logs_recipient_email ON public.communication_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_communication_logs_sender_phone ON public.communication_logs(sender_phone);
CREATE INDEX IF NOT EXISTS idx_communication_logs_sender_email ON public.communication_logs(sender_email);
CREATE INDEX IF NOT EXISTS idx_communication_logs_brand ON public.communication_logs(brand);
CREATE INDEX IF NOT EXISTS idx_communication_logs_created_at ON public.communication_logs(created_at DESC);

-- Enable realtime for communication_logs so all modules sync instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_logs;

-- Create a table for unmatched incoming messages that need VA review
CREATE TABLE IF NOT EXISTS public.unmatched_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  channel text NOT NULL,
  sender_phone text,
  sender_email text,
  message_content text,
  ai_suggested_contact_id uuid REFERENCES public.crm_contacts(id),
  ai_confidence_score numeric(3,2),
  matched_by uuid REFERENCES public.profiles(id),
  matched_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'dismissed')),
  business_id uuid REFERENCES public.businesses(id)
);

-- Enable RLS on unmatched_messages
ALTER TABLE public.unmatched_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view unmatched messages for their business
CREATE POLICY "Users can view unmatched messages for their business"
ON public.unmatched_messages
FOR SELECT
USING (
  business_id IN (
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
  )
);

-- Policy: Users can update unmatched messages for their business
CREATE POLICY "Users can update unmatched messages for their business"
ON public.unmatched_messages
FOR UPDATE
USING (
  business_id IN (
    SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
  )
);

-- Enable realtime for unmatched_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.unmatched_messages;